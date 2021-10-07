import {
  Broker,
  ConcurrencyError,
  EvtOf,
  log,
  MsgOf,
  Store
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";

const pool = new Pool(config.pg);
delete config.pg.password; // use it and forget it

const create_script = (table: string): string => `
CREATE TABLE IF NOT EXISTS public.${table}
(
	id serial PRIMARY KEY,
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    data json,
    stream character varying(100) COLLATE pg_catalog."default" NOT NULL,
    version int NOT NULL,
    created timestamp without time zone DEFAULT now()
) TABLESPACE pg_default;
ALTER TABLE public.${table} OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS stream_ix
    ON public.${table} USING btree
    (stream COLLATE pg_catalog."default" ASC, version ASC)
    TABLESPACE pg_default;
	
CREATE INDEX IF NOT EXISTS name_ix
    ON public.${table} USING btree
    (name COLLATE pg_catalog."default" ASC)
    TABLESPACE pg_default;`;

type Event = {
  id: number;
  name: string;
  data: any;
  stream: string;
  version: number;
  created: Date;
};

export const PostgresStore = (table: string): Store => ({
  init: async (): Promise<void> => {
    await pool.query(create_script(table));
  },

  close: async (): Promise<void> => {
    await pool.end();
  },

  read: async <E>(
    callback: (event: EvtOf<E>) => void,
    options?: { stream?: string; name?: string; after: number; limit: number }
  ): Promise<void> => {
    const { stream, name, after = -1, limit } = options;

    const values: any[] = [after];
    let sql = `SELECT * FROM ${table} WHERE id>$1`;
    if (stream) {
      values.push(stream);
      sql = sql.concat(` AND stream=$${values.length}`);
    }
    if (name) {
      values.push(name);
      sql = sql.concat(` AND name=$${values.length}`);
    }
    sql = sql.concat(" ORDER BY id");
    if (limit) {
      values.push(limit);
      sql = sql.concat(` LIMIT $${values.length}`);
    }

    (await pool.query<Event>(sql, values)).rows.map((e) =>
      callback(e as EvtOf<E>)
    );
  },

  commit: async <E>(
    stream: string,
    events: MsgOf<E>[],
    expectedVersion?: string,
    broker?: Broker
  ): Promise<EvtOf<E>[]> => {
    const client = await pool.connect();
    let version = -1;
    try {
      await client.query("BEGIN");
      const last = await client.query<Event>(
        `SELECT version FROM ${table} WHERE stream=$1 ORDER BY version DESC LIMIT 1`,
        [stream]
      );
      version = last.rowCount ? last.rows[0].version : -1;
      if (expectedVersion && version.toString() !== expectedVersion)
        throw new ConcurrencyError(version, events, expectedVersion);

      const committed = await Promise.all(
        events.map(async ({ name, data }) => {
          version++;
          const committed = await client.query<Event>(
            `INSERT INTO ${table}(name, data, stream, version)
          VALUES($1, $2, $3, $4) RETURNING *`,
            [name, data, stream, version]
          );
          return committed.rows[0] as EvtOf<E>;
        })
      );

      // publish inside transaction to ensure "at-least-once" delivery
      if (broker) await Promise.all(committed.map((e) => broker.publish(e)));

      await client.query("COMMIT");
      return committed;
    } catch (e) {
      await client.query("ROLLBACK");
      log().error(e);
      throw new ConcurrencyError(version, events, expectedVersion);
    } finally {
      client.release();
    }
  }
});
