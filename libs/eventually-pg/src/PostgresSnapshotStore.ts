import { dispose, log, SnapshotStore } from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";
import { snapshot } from "./seed";

export const PostgresSnapshotStore = (table: string): SnapshotStore => {
  const pool = new Pool(config.pg);
  const store: SnapshotStore = {
    name: `PostgresSnapshotStore:${table}`,
    dispose: async () => {
      await pool.end();
    },

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
    },

    query: async (query) => {
      const { limit = 10 } = query;

      const values: any[] = [];
      let sql = `SELECT * FROM ${table}`;
      if (limit) {
        values.push(limit);
        sql = sql.concat(` LIMIT $${values.length}`);
      }

      const result = await pool.query(sql, values);
      return result.rows.map((r) => r.data);
    }
  };

  log().info("bgGreen", `✨ ${store.name}`);
  dispose(() => {
    log().info("bgGreen", `♻️ ${store.name}`);
    return store.dispose();
  });

  return store;
};
