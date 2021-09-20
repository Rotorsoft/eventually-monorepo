import { Pool } from "pg";
import { Store, CommittedEvent, Message, Payload } from "@rotorsoft/eventually";
import { config } from "./config";

const pool = new Pool(config.pg);

type Event = {
  event_id: bigint;
  event_name: string;
  event_data: any;
  aggregate_id: string;
  aggregate_version: bigint;
  created_at: Date;
};

export const PostgresStore = (): Store => ({
  load: async (
    id: string,
    reducer: (event: CommittedEvent<string, Payload>) => void
  ): Promise<void> => {
    const result = await pool.query<Event>(
      "SELECT * FROM events WHERE aggregate_id=$1 ORDER BY aggregate_version",
      [id]
    );
    result.rows.map((e) =>
      reducer({
        id,
        version: e.aggregate_version.toString(),
        timestamp: e.created_at,
        name: e.event_name,
        data: e.event_data
      })
    );
  },

  commit: async (
    id: string,
    { name, data }: Message<string, Payload>,
    expectedVersion?: string
  ): Promise<CommittedEvent<string, Payload>> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const last = await client.query<Event>(
        "SELECT aggregate_version FROM events WHERE aggregate_id=$1 ORDER BY aggregate_version DESC LIMIT 1",
        [id]
      );
      let version = last.rowCount ? last.rows[0].aggregate_version : -1;
      if (expectedVersion && version.toString() !== expectedVersion)
        throw Error("Concurrency Error");
      version++;
      const committed = await client.query<Event>(
        `INSERT INTO events(event_name, event_data, aggregate_id, aggregate_version)
        VALUES($1, $2, $3, $4) RETURNING created_at`,
        [name, data, id, version]
      );
      await client.query("COMMIT");
      return {
        id,
        version: version.toString(),
        timestamp: committed.rows[0].created_at,
        name,
        data
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
});
