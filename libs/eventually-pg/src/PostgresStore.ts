import { Pool } from "pg";
import {
  Store,
  EvtOf,
  Evt,
  MsgOf,
  ConcurrencyError
} from "@rotorsoft/eventually";
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

  load: async <E>(
    stream: string,
    reducer: (event: EvtOf<E>) => void
  ): Promise<void> => {
    const events = await pool.query<Event>(
      `SELECT * FROM ${table} WHERE stream=$1 ORDER BY version`,
      [stream]
    );
    events.rows.map((e) =>
      reducer({
        id: e.id,
        name: e.name as keyof E & string,
        data: e.data,
        stream: e.stream,
        version: e.version.toString(),
        created: e.created
      })
    );
  },

  commit: async <E>(
    stream: string,
    events: MsgOf<E>[],
    expectedVersion?: string
  ): Promise<EvtOf<E>[]> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const last = await client.query<Event>(
        `SELECT version FROM ${table} WHERE stream=$1 ORDER BY version DESC LIMIT 1`,
        [stream]
      );
      let version = last.rowCount ? last.rows[0].version : -1;
      if (expectedVersion && version.toString() !== expectedVersion)
        throw new ConcurrencyError(version, events, expectedVersion);
      const committed = await Promise.all(
        events.map(async ({ name, data }) => {
          version++;
          const committed = await client.query<Event>(
            `INSERT INTO ${table}(name, data, stream, version)
          VALUES($1, $2, $3, $4) RETURNING id, created`,
            [name, data, stream, version]
          );
          const { id, created } = committed.rows[0];
          return {
            id,
            name,
            data,
            stream,
            version: version.toString(),
            created
          };
        })
      );
      await client.query("COMMIT");
      return committed;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  read: async (name?: string, after = -1, limit = 1): Promise<Evt[]> => {
    const events = await pool.query<Event>(
      `SELECT * FROM ${table} WHERE id > $1 ${
        name ? "AND name = $3" : ""
      } ORDER BY id LIMIT $2`,
      name ? [after, limit, name] : [after, limit]
    );

    return events.rows.map((e) => ({
      id: e.id,
      name: e.name,
      data: e.data,
      stream: e.stream,
      version: e.version.toString(),
      created: e.created
    }));
  }
});
