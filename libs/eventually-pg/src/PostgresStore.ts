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

const create_script = `
CREATE TABLE IF NOT EXISTS public.events
(
	event_id serial PRIMARY KEY,
    event_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    event_data json,
    aggregate_id character varying(100) COLLATE pg_catalog."default" NOT NULL,
    aggregate_version int NOT NULL,
    created_at timestamp without time zone DEFAULT now()
) TABLESPACE pg_default;
ALTER TABLE public.events OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS aggregate_ix
    ON public.events USING btree
    (aggregate_id COLLATE pg_catalog."default" ASC, aggregate_version ASC)
    TABLESPACE pg_default;
	
CREATE INDEX IF NOT EXISTS topic_ix
    ON public.events USING btree
    (event_name COLLATE pg_catalog."default" ASC)
    TABLESPACE pg_default;`;

type Event = {
  event_id: number;
  event_name: string;
  event_data: any;
  aggregate_id: string;
  aggregate_version: number;
  created_at: Date;
};

export const PostgresStore = (): Store => ({
  init: async (): Promise<void> => {
    await pool.query(create_script);
  },

  close: async (): Promise<void> => {
    await pool.end();
  },

  load: async <E>(
    id: string,
    reducer: (event: EvtOf<E>) => void
  ): Promise<void> => {
    const events = await pool.query<Event>(
      "SELECT * FROM events WHERE aggregate_id=$1 ORDER BY aggregate_version",
      [id]
    );
    events.rows.map((e) =>
      reducer({
        eventId: e.event_id,
        aggregateId: e.aggregate_id,
        aggregateVersion: e.aggregate_version.toString(),
        createdAt: e.created_at,
        name: e.event_name as keyof E & string,
        data: e.event_data
      })
    );
  },

  commit: async <E>(
    id: string,
    events: MsgOf<E>[],
    expectedVersion?: string
  ): Promise<EvtOf<E>[]> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const last = await client.query<Event>(
        "SELECT aggregate_version FROM events WHERE aggregate_id=$1 ORDER BY aggregate_version DESC LIMIT 1",
        [id]
      );
      let version = last.rowCount ? last.rows[0].aggregate_version : -1;
      if (expectedVersion && version.toString() !== expectedVersion)
        throw new ConcurrencyError(
          last.rows[0].aggregate_version,
          events,
          expectedVersion
        );
      const committed = await Promise.all(
        events.map(async ({ name, data }) => {
          version++;
          const committed = await client.query<Event>(
            `INSERT INTO events(event_name, event_data, aggregate_id, aggregate_version)
          VALUES($1, $2, $3, $4) RETURNING event_id, created_at`,
            [name, data, id, version]
          );
          const { event_id, created_at } = committed.rows[0];
          return {
            eventId: event_id,
            aggregateId: id,
            aggregateVersion: version.toString(),
            createdAt: created_at,
            name,
            data
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
      `SELECT * FROM events WHERE event_id > $1 ${
        name ? "AND event_name = $3" : ""
      } ORDER BY event_id LIMIT $2`,
      name ? [after, limit, name] : [after, limit]
    );

    return events.rows.map((e) => ({
      eventId: e.event_id,
      aggregateId: e.aggregate_id,
      aggregateVersion: e.aggregate_version.toString(),
      createdAt: e.created_at,
      name: e.event_name,
      data: e.event_data
    }));
  }
});
