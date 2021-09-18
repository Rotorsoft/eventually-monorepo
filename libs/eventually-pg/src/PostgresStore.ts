import { Pool } from "pg";
import { Store, CommittedEvent, Message } from "@rotorsoft/eventually";
import { config } from "./config";

const pool = new Pool(config.pg);

export const PostgresStore = (): Store => ({
  load: async (
    id: string,
    reducer: (event: CommittedEvent<string, any>) => void
  ): Promise<void> => {
    const result = await pool.query<CommittedEvent<string, any>>(
      "SELECT version, name, data FROM events WHERE id=$1 ORDER BY version",
      [id]
    );
    result.rows.map(({ version, name, data }) =>
      reducer({
        id,
        version: version.toString(),
        name,
        data
      })
    );
  },

  commit: async (
    id: string,
    { name, data }: Message<string, any>,
    expectedVersion?: string
  ): Promise<CommittedEvent<string, any>> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const last = await client.query<CommittedEvent<string, any>>(
        "SELECT version FROM events WHERE id=$1 ORDER BY version DESC LIMIT 1",
        [id]
      );
      let version = last.rowCount ? last.rows[0].version : "-1";
      if (expectedVersion && version !== expectedVersion)
        throw Error("Concurrency Error");
      version = (Number.parseInt(version) + 1).toString();
      await client.query<CommittedEvent<string, any>>(
        "INSERT INTO events(id, version, name, data) VALUES($1, $2, $3, $4)",
        [id, version, name, data]
      );
      await client.query("COMMIT");
      return { id, version, name, data };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
});
