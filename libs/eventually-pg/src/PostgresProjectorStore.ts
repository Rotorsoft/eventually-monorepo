import {
  Condition,
  dispose,
  log,
  Operator,
  ProjectionQuery,
  ProjectionRecord,
  ProjectionResults,
  ProjectorStore,
  State,
  StateWithId
} from "@rotorsoft/eventually";
import { Pool, types } from "pg";
import { config } from "./config";
import { projector, ProjectionSchema } from "./seed";

types.setTypeParser(types.builtins.INT8, (val) => parseInt(val, 10));

const EQUALS: Operator[] = ["eq", "lte", "gte", "in"];

const OPS: Record<Operator, string> = {
  eq: "=",
  neq: "<>",
  lt: "<",
  gt: ">",
  lte: "<=",
  gte: ">=",
  in: "in",
  nin: "not in"
};

export const PostgresProjectorStore = <S extends State>(
  table: string,
  schema: ProjectionSchema<S>,
  indexes: string
): ProjectorStore<S> => {
  const pool = new Pool(config.pg);
  const store: ProjectorStore<S> = {
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
      return result.rows.map(({ __watermark, ...state }) => {
        return {
          state: state as any,
          watermark: __watermark
        };
      });
    },

    commit: async (projection, watermark) => {
      const upserts: Array<{
        where: Partial<StateWithId<S>>;
        sql: string;
        vals: any[];
      }> = [];
      const deletes: Array<{
        where: Partial<StateWithId<S>>;
        sql: string;
        vals: any[];
      }> = [];
      const results: ProjectionResults<S> = {
        upserted: [],
        deleted: [],
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
              where,
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
            deletes.push({ where, sql, vals: where_entries.map(([, v]) => v) });
          }
        });

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const { where, sql, vals } of upserts) {
          const count = (await client.query(sql, vals)).rowCount;
          results.upserted.push({ where, count });
        }
        for (const { where, sql, vals } of deletes) {
          const count = (await client.query(sql, vals)).rowCount;
          results.deleted.push({ where, count });
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

    query: async (
      query: ProjectionQuery<S>,
      callback: (record: ProjectionRecord<S>) => void
    ): Promise<number> => {
      const fields = query.select
        ? query.select
            .map((field) => `"${field as string}"`)
            .join(", ")
            .concat(", __watermark")
        : "*";
      const where = query.where
        ? "WHERE ".concat(
            Object.entries(query.where)
              .map(
                (
                  [key, { value, operator }]: [string, Condition<any>],
                  index
                ) => {
                  const operation =
                    value === null
                      ? EQUALS.includes(operator)
                        ? "is null"
                        : "is not null"
                      : `${OPS[operator]} $${index + 1}`;
                  return `${table}."${key}" ${operation}`;
                }
              )
              .join(" AND ")
          )
        : "";
      const sort = query.sort
        ? "ORDER BY ".concat(
            Object.entries(query.sort)
              .map(([key, order]) => `"${key}" ${order}`)
              .join(", ")
          )
        : "";

      const values = query.where
        ? Object.values(query.where).map(({ value }: Condition<any>) => value)
        : [];
      const limit = query.limit ? `LIMIT ${query.limit}` : "";
      const sql = `SELECT ${fields} FROM ${table} ${where} ${sort} ${limit}`;
      const result = await pool.query<S & { __watermark: number }>(sql, values);
      for (const { __watermark, ...state } of result.rows)
        callback({ state: state as any, watermark: __watermark });
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
