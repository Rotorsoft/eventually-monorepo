import {
  app,
  SnapshotStore
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";

const create_script = (table: string): string => `
CREATE TABLE IF NOT EXISTS public.${table}
(
  stream character varying(100) COLLATE pg_catalog."default" NOT NULL PRIMARY KEY,
  data json
) TABLESPACE pg_default;
ALTER TABLE public.${table} OWNER to postgres;`;

const tables: Set<string> = new Set();

export const PostgresSnapshotStore = (table: string): SnapshotStore =>  {
  const pool = new Pool(config.pg);
  // delete config.pg.password; // use it and forget it
  let initialized = false;
  table && tables.add(table);

  const store: SnapshotStore = {
    init: async () => {
      if (!initialized)
        return Promise.all(
          Array.from(tables).map((table)=>{
            const sql = create_script(table);
            return pool.query(sql);
          })
        ).then(() => {initialized = true})
    },

    close: async () => {
      await pool.end();
    },

    read: async (
      stream
    ) => {
      const sql = `SELECT * FROM ${table} WHERE stream=$1`;
      const result = await pool.query(sql, [stream]);
      result.rows[0] && app().log.trace("white", `Snapshot loaded for stream ${stream}`)
      return result.rows[0]?.data;
    },

    upsert: async (
      stream,
      data
    ) => {
      await pool.query(
        `INSERT INTO ${table}(stream, data) VALUES($1, $2)
          ON CONFLICT (stream)
          DO
          UPDATE set data=$2 WHERE ${table}.stream=$1`,
        [stream, data]
      );
      app().log.trace("white", `Snapshot Created for stream ${stream}`)
    }
  };

  return store;
};
