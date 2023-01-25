import {
  dateReviver,
  dispose,
  log,
  SnapshotStore
} from "@rotorsoft/eventually";
import { Pool, types } from "pg";
import { config } from "./config";
import { snapshot } from "./seed";

types.setTypeParser(types.builtins.JSON, (val) => JSON.parse(val, dateReviver));

export const PostgresSnapshotStore = (
  table: string,
  threshold: number
): SnapshotStore => {
  const pool = new Pool(config.pg);
  const store: SnapshotStore = {
    name: `PostgresSnapshotStore:${table}`,
    dispose: async () => {
      await pool.end();
    },

    seed: async () => {
      await pool.query(snapshot(table));
    },

    threshold,

    read: async (stream) => {
      const sql = `SELECT * FROM ${table} WHERE stream=$1`;
      const result = await pool.query(sql, [stream]);
      result.rows[0] && log().trace(`Snapshot loaded for stream ${stream}`);
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
      log().trace(`Snapshot Created for stream ${stream}`);
    }
  };

  log().info(`[${process.pid}] ✨ ${store.name}`);
  dispose(() => {
    if (store.dispose) {
      log().info(`[${process.pid}] ♻️ ${store.name}`);
      return store.dispose();
    }
    return Promise.resolve();
  });

  return store;
};
