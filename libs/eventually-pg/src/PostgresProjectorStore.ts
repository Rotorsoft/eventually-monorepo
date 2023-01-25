import {
  dispose,
  log,
  ProjectionQuery,
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
      const upserts: Array<{ sql: string; vals: any[] }> = [];
      const deletes: Array<{ sql: string; vals: any[] }> = [];
      const results = {
        projection,
        upserted: 0,
        deleted: 0,
        watermark
      };

      projection.upserts &&
        projection.upserts.forEach(({ where, values }) => {
          const id = where.id || values.id; // when id found in filter or values -> full upsert, otherwise update
          const where_entries = Object.entries(where);
          const values_entries = Object.entries(values);
          if (where_entries.length && values_entries.length) {
            const sql = (
              id
                ? `INSERT INTO ${table}(id, ${values_entries
                    .map(([k]) => `"${k}"`)
                    .join(", ")}, __watermark) VALUES('${id}', ${values_entries
                    .map((_, index) => `$${where_entries.length + index + 1}`)
                    .join(", ")}, ${watermark}) ON CONFLICT (id) DO
                `
                : ""
            ).concat(
              `UPDATE ${id ? "" : table} SET ${values_entries
                .map(
                  ([k], index) => `"${k}"=$${where_entries.length + index + 1}`
                )
                .join(
                  ", "
                )} WHERE ${table}.__watermark < ${watermark} AND ${where_entries
                .map(([k], index) => `${table}."${k}"=$${index + 1}`)
                .join(" AND ")}`
            );
            upserts.push({
              sql,
              vals: where_entries
                .map(([, v]) => v)
                .concat(values_entries.map(([, v]) => v))
            });
          }
        });

      projection.deletes &&
        projection.deletes.forEach(({ where }) => {
          const where_entries = Object.entries(where);
          if (where_entries.length) {
            const sql = `DELETE FROM ${table} WHERE ${table}.__watermark < ${watermark} AND ${where_entries
              .map(([k], index) => `${table}."${k}"=$${index + 1}`)
              .join(" AND ")}`;
            deletes.push({ sql, vals: where_entries.map(([, v]) => v) });
          }
        });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const { sql, vals } of upserts) {
          results.upserted += (await client.query(sql, vals)).rowCount;
        }
        for (const { sql, vals } of deletes) {
          results.deleted += (await client.query(sql, vals)).rowCount;
        }
        await client.query("COMMIT");
        return results;
      } catch (error) {
        log().error(error);
        upserts.forEach(({ sql, vals }) => log().red().trace(sql, vals));
        deletes.forEach(({ sql, vals }) => log().red().trace(sql, vals));
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    query: async <S extends ProjectionState>(
      query: ProjectionQuery<S>,
      callback: (state: Partial<S>, watermark: number) => void
    ): Promise<number> => {
      const fields = query.select
        ? query.select.join(", ").concat(", __watermark")
        : "*";
      const where = query.where
        ? "WHERE ".concat(
            Object.entries(query.where)
              .map(
                ([key, condition], index) =>
                  `${key}${condition.operator}$${index + 1}`
              )
              .join(" AND ")
          )
        : "";
      const values = query.where
        ? Object.values(query.where).map((condition) => condition.value)
        : [];
      const limit = query.limit ? `LIMIT ${query.limit}` : "";
      const sql = `SELECT ${fields} FROM ${table} ${where} ${limit}`;
      const result = await pool.query<S & { __watermark: number }>(sql, values);
      for (const { __watermark, ...state } of result.rows)
        callback(state as unknown as Partial<S>, __watermark);
      return result.rowCount;
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
