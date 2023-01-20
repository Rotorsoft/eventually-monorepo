import {
  dispose,
  log,
  ProjectionState,
  ProjectorStore
} from "@rotorsoft/eventually";
import { Pool, types } from "pg";
import { config } from "./config";
import { projector, ProjectionSchema } from "./seed";

types.setTypeParser(types.builtins.INT8, (val) => parseInt(val, 10));

export const PostgresProjectorStore = <S extends ProjectionState>(
  table: string,
  schema: ProjectionSchema<S>,
  indexes: string
): ProjectorStore => {
  const pool = new Pool(config.pg);
  const store: ProjectorStore = {
    name: `PostgresProjectorStore:${table}`,
    dispose: async () => {
      await pool.end();
    },

    seed: async () => {
      const seed = projector<S>(table, schema, indexes);
      log().magenta().trace(seed);
      await pool.query(seed);
    },

    load: async (ids) => {
      const sql = `SELECT * FROM ${table} WHERE id in (${ids
        .map((id) => `'${id}'`)
        .join(", ")})`;
      const result = await pool.query<S & { __watermark: number }>(sql);
      return result.rows.reduce((p, c) => {
        const state = Object.fromEntries(
          Object.entries(c).filter(([k, v]) => v && k !== "__watermark")
        );
        p[state.id] = { state, watermark: c.__watermark };
        return p;
      }, {} as Record<string, any>);
    },

    commit: async (projection, watermark) => {
      const id = projection.upsert?.[0].id || projection.upsert?.[1].id; // when id found in filter or values -> full upsert, otherwise update
      const upsert_filter = projection.upsert
        ? Object.entries(projection.upsert[0])
        : undefined;
      const upsert_values = projection.upsert
        ? Object.entries(projection.upsert[1])
        : undefined;
      const delete_filter = projection.delete
        ? Object.entries(projection.delete)
        : undefined;

      const ins =
        upsert_filter && upsert_values && id
          ? `INSERT INTO ${table}(id, ${upsert_values
              .map(([k]) => `"${k}"`)
              .join(", ")}, __watermark) VALUES('${id}', ${upsert_values
              .map((_, index) => `$${upsert_filter.length + index + 1}`)
              .join(", ")}, ${watermark}) ON CONFLICT (id) DO
              `
          : "";

      const upd =
        upsert_filter && upsert_values
          ? `UPDATE ${id ? "" : table} SET ${upsert_values
              .map(
                ([k], index) => `"${k}"=$${upsert_filter.length + index + 1}`
              )
              .join(
                ", "
              )} WHERE ${table}.__watermark < ${watermark} AND ${upsert_filter
              .map(([k], index) => `${table}."${k}"=$${index + 1}`)
              .join(" AND ")}`
          : undefined;

      const ups = upd ? ins.concat(upd) : undefined;
      const ups_v =
        upsert_filter && upsert_values
          ? upsert_filter
              .map(([, v]) => v)
              .concat(upsert_values.map(([, v]) => v))
          : [];

      const del = delete_filter
        ? `DELETE FROM ${table} WHERE ${table}.__watermark < ${watermark} AND ${delete_filter
            .map(([k], index) => `${table}."${k}"=$${index + 1}`)
            .join(" AND ")}`
        : undefined;
      const del_v = delete_filter ? delete_filter.map(([, v]) => v) : [];

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const upserted = ups ? (await client.query(ups, ups_v)).rowCount : 0;
        const deleted = del ? (await client.query(del, del_v)).rowCount : 0;
        await client.query("COMMIT");
        return Promise.resolve({
          projection,
          upserted,
          deleted,
          watermark
        });
      } catch (error) {
        log().error(error);
        ups && log().red().trace(ups, ups_v);
        del && log().red().trace(del, del_v);
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
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
