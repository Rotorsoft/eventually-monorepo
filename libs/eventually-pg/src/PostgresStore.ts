import { Pool } from "pg";
import { Store, CommittedEvent, Message, Payload } from "@rotorsoft/eventually";
import { config } from "./config";

const pool = new Pool(config.pg);

export const PostgresStore = (): Store => ({
  load: async (
    id: string,
    reducer: (event: CommittedEvent<string, Payload>) => void
  ): Promise<void> => {
    const result = await pool.query<CommittedEvent<string, Payload>>(
      "SELECT version, timestamp, name, data FROM events WHERE id=$1 ORDER BY version",
      [id]
    );
    result.rows.map(({ version, name, timestamp, data }) =>
      reducer({
        id,
        version: version.toString(),
        timestamp,
        name,
        data
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
      const last = await client.query<CommittedEvent<string, Payload>>(
        "SELECT version FROM events WHERE id=$1 ORDER BY version DESC LIMIT 1",
        [id]
      );
      let version = last.rowCount ? last.rows[0].version : "-1";
      if (expectedVersion && version !== expectedVersion)
        throw Error("Concurrency Error");
      version = (Number.parseInt(version) + 1).toString();
      const committed = await client.query<CommittedEvent<string, Payload>>(
        "INSERT INTO events(id, version, name, data) VALUES($1, $2, $3, $4) RETURNING timestamp",
        [id, version, name, data]
      );
      await client.query("COMMIT");
      return {
        id,
        version,
        timestamp: committed.rows[0].timestamp,
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
