import { app, SnapshotStore } from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";

const create_script = (table: string): string => `
CREATE TABLE IF NOT EXISTS public.${table}
(
  stream character varying(100) COLLATE pg_catalog."default" NOT NULL PRIMARY KEY,
  data json
) TABLESPACE pg_default;
ALTER TABLE public.${table} OWNER to postgres;`;

export const PostgresSnapshotStore = (table?: string): SnapshotStore => {
  let pool: Pool;
  table = table || config.pg.snapshotsTable;

  return {
    init: async () => {
      if (!pool) {
        pool = new Pool(config.pg);
        await pool.query(create_script(table));
      }
    },

    close: async () => {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },

    read: async (stream) => {
      const sql = `SELECT * FROM ${table} WHERE stream=$1`;
      const result = await pool.query(sql, [stream]);
      result.rows[0] &&
        app().log.trace("white", `Snapshot loaded for stream ${stream}`);
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
      app().log.trace("white", `Snapshot Created for stream ${stream}`);
    }
  };
};
