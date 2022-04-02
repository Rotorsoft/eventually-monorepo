import { dispose, log, SnapshotStore } from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";
import { snapshot } from "./seed";

export const PostgresSnapshotStore = (table?: string): SnapshotStore => {
  table = table || config.pg.snapshotsTable;
  const pool = new Pool(config.pg);

  log().info("bgGreen", `✨ PostgresSnapshotStore:${table}`);
  dispose(() => {
    log().info("bgGreen", `♻️ PostgresSnapshotStore:${table}`);
    return pool.end();
  });

  return {
    seed: async () => {
      await pool.query(snapshot(table));
    },

    read: async (stream) => {
      const sql = `SELECT * FROM ${table} WHERE stream=$1`;
      const result = await pool.query(sql, [stream]);
      result.rows[0] &&
        log().trace("white", `Snapshot loaded for stream ${stream}`);
      return result.rows[0]?.data;
    },

    upsert: async (stream, data) => {
      await pool.query(
        `INSERT INTO ${table}(stream, data) VALUES($1, $2)
          ON CONFLICT (stream)
          DO
          UPDATE set data=$2 WHERE ${table}.stream=$1`,
        [stream, data]
      );
      log().trace("white", `Snapshot Created for stream ${stream}`);
    }
  };
};
