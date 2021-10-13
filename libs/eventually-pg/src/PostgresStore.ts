import {
  AllQuery,
  ConcurrencyError,
  Evt,
  log,
  Msg,
  Store
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";

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

export const PostgresStore = (table: string): Store => {
  const pool = new Pool(config.pg);
  delete config.pg.password; // use it and forget it
  let initialized = false;

  return {
    init: async (): Promise<void> => {
      if (!initialized) await pool.query(create_script(table));
      initialized = true;
    },

    /* TODO: getLastEvent: async (stream:string)=> {
    return pool.query<Event>(
      `SELECT * FROM ${table} WHERE stream=$1 ORDER BY version DESC LIMIT 1`,
      [stream]
    )
      .then(x=> x.rows.length && formatEvent(x.rows[0]))
  }, */

    close: async (): Promise<void> => {
      await pool.end();
    },

    read: async (
      callback: (event: Evt) => void,
      query?: AllQuery
    ): Promise<void> => {
      const { stream, name, after = -1, limit } = query;

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
        callback(e as Evt)
      );
    },

    commit: async (
      stream: string,
      events: Msg[],
      expectedVersion?: number,
      callback?: (events: Evt[]) => Promise<void>
    ): Promise<Evt[]> => {
      const client = await pool.connect();
      let version = -1;
      try {
        await client.query("BEGIN");
        const last = await client.query<Event>(
          `SELECT version FROM ${table} WHERE stream=$1 ORDER BY version DESC LIMIT 1`,
          [stream]
        );
        version = last.rowCount ? last.rows[0].version : -1;
        if (expectedVersion && version !== expectedVersion)
          throw new ConcurrencyError(version, events, expectedVersion);

        const committed = await Promise.all(
          events.map(async ({ name, data }) => {
            version++;
            const committed = await client.query<Event>(
              `INSERT INTO ${table}(name, data, stream, version)
          VALUES($1, $2, $3, $4) RETURNING *`,
              [name, data, stream, version]
            );
            return committed.rows[0] as Evt;
          })
        );

        if (callback) await callback(committed);

        await client.query("COMMIT").catch((error) => {
          log().error(error);
          throw new ConcurrencyError(version, events, expectedVersion);
        });
        return committed;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  };
};
