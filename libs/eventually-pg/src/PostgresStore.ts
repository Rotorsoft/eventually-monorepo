import { Pool } from "pg";
import { Store, EvtOf, Evt, MsgOf, Payload } from "@rotorsoft/eventually";
import { config } from "./config";

const pool = new Pool(config.pg);
delete config.pg.password; // use it and forget it

type Event = {
  event_id: number;
  event_name: string;
  event_data: any;
  aggregate_id: string;
  aggregate_version: number;
  created_at: Date;
};

export class ConcurrencyError extends Error {
  constructor(
    public readonly lastVersion: number,
    public readonly event: { name: string; data: Payload },
    public readonly expectedVersion: string
  ) {
    super("Concurrency Error");
  }
}

export const PostgresStore = (): Store => ({
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
    { name, data }: MsgOf<E>,
    expectedVersion?: string
  ): Promise<EvtOf<E>> => {
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
          { name, data },
          expectedVersion
        );
      version++;
      const committed = await client.query<Event>(
        `INSERT INTO events(event_name, event_data, aggregate_id, aggregate_version)
        VALUES($1, $2, $3, $4) RETURNING event_id, created_at`,
        [name, data, id, version]
      );
      await client.query("COMMIT");
      const { event_id, created_at } = committed.rows[0];
      return {
        eventId: event_id,
        aggregateId: id,
        aggregateVersion: version.toString(),
        createdAt: created_at,
        name,
        data
      };
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
