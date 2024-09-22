import type {
  Agg,
  AggQuery,
  Operator,
  ProjectionWhere,
  ProjectorStore,
  State
} from "@rotorsoft/eventually";
import {
  conditions,
  dispose,
  log,
  logAdapterCreated,
  logAdapterDisposed,
  patch
} from "@rotorsoft/eventually";
import { Pool, types } from "pg";
import { config } from "./config";
import { projector } from "./seed";

types.setTypeParser(types.builtins.INT8, (val) => parseInt(val, 10));
types.setTypeParser(types.builtins.FLOAT4, (val) => parseFloat(val));
types.setTypeParser(types.builtins.FLOAT8, (val) => parseFloat(val));
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));

const EQUALS: Operator[] = ["eq", "lte", "gte", "in"];

const pgOperators: Record<Operator, string> = {
  eq: "=",
  neq: "<>",
  lt: "<",
  gt: ">",
  lte: "<=",
  gte: ">=",
  in: "in",
  nin: "not in"
};

const filter = (where: ProjectionWhere<State>, values: any[]): string => {
  const offset = values.length;
  return Object.entries(where)
    .flatMap(([key, condition], i) =>
      conditions(condition!).map(([operator, value], j) => {
        const operation =
          value === null
            ? EQUALS.includes(operator)
              ? "is null"
              : "is not null"
            : `${pgOperators[operator]} $${offset + i + j + 1}`;
        values.push(value);
        return `"${key}" ${operation}`;
      })
    )
    .join(" AND ");
};

export const PostgresProjectorStore = <S extends State>(
  table: string
): ProjectorStore<S> => {
  const pool = new Pool(config.pg);
  const store: ProjectorStore<S> = {
    name: `PostgresProjectorStore:${table}`,
    dispose: async () => {
      await pool.end();
    },

    seed: async (schema, indexes) => {
      const seed = projector<S>(table, schema, indexes);
      log().green().info(`>>> Seeding projector table: ${table}`);
      log().gray().info(seed);
      await pool.query(seed);
    },

    drop: async (): Promise<void> => {
      await pool.query(`DROP TABLE IF EXISTS "${table}"`);
    },

    load: async (ids) => {
      const sql = `SELECT * FROM "${table}" WHERE id in (${ids
        .map((id) => `'${id}'`)
        .join(", ")})`;
      log().green().data("sql:", sql);

      const result = await pool.query<S & { __watermark: number }>(sql);
      return result.rows.map(({ __watermark, ...state }) => {
        return {
          state: state as any,
          watermark: __watermark
        };
      });
    },

    commit: async (map, watermark) => {
      const deletes: Array<{ sql: string; vals: any[] }> = [];
      const upserts: Array<{ sql: string; vals: any[] }> = [];

      // filtered deletes
      map.deletes.forEach((del) => {
        const vals = [] as any[];
        const where = filter(del, vals);
        deletes.push({
          sql: `DELETE FROM "${table}" WHERE __watermark < ${watermark} AND ${where}`,
          vals
        });
      });

      // filtered updates
      map.updates.forEach((p) => {
        if ("where" in p && p.where) {
          const { where, ...patch } = p;
          const vals = Object.values(patch);
          const _where = filter(where, vals);
          upserts.push({
            sql: `UPDATE "${table}" SET ${Object.keys(patch)
              .map((key, index) => `"${key}"=$${index + 1}`)
              .join(
                ", "
              )}, __watermark=${watermark} WHERE __watermark < ${watermark} AND ${_where}`,
            vals
          });
        }
      });

      // patched records
      map.records.forEach((patch, id) => {
        const vals = Object.entries(patch);
        if (vals.length) {
          const sql = `INSERT INTO "${table}"(id, ${vals
            .map(([k]) => `"${k}"`)
            .join(", ")}, __watermark) VALUES('${id}', ${vals
            .map((_, index) => `$${index + 1}`)
            .join(", ")}, ${watermark}) ON CONFLICT (id) DO UPDATE SET ${vals
            .map(([k], index) => `"${k}"=$${index + 1}`)
            .join(
              ", "
            )}, __watermark=${watermark} WHERE "${table}".__watermark < ${watermark} AND "${table}".id='${id}'`;
          upserts.push({ sql, vals: vals.map(([, v]) => v) });
        } else
          deletes.push({
            sql: `DELETE FROM "${table}" WHERE __watermark < ${watermark} AND "${table}".id='${id}'`,
            vals: []
          });
      });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let upserted = 0,
          deleted = 0;
        for (const { sql, vals } of deletes) {
          log().green().data("sql:", sql, vals);
          deleted += (await client.query(sql, vals)).rowCount ?? 0;
        }
        for (const { sql, vals } of upserts) {
          log().green().data("sql:", sql, vals);
          upserted += (await client.query(sql, vals)).rowCount ?? 0;
        }
        await client.query("COMMIT");
        return { upserted, deleted, watermark };
      } catch (error) {
        log().error(error);
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    query: async (query) => {
      const fields = query.select
        ? query.select
            .map((field) => `"${field as string}"`)
            .join(", ")
            .concat(", __watermark")
        : "*";
      const values: any[] = [];
      const where = query.where
        ? "WHERE ".concat(filter(query.where, values))
        : "";
      const sort = query.sort
        ? "ORDER BY ".concat(
            Object.entries(query.sort)
              .map(([key, order]) => `"${key}" ${order}`)
              .join(", ")
          )
        : "";
      const limit = query.limit ? `LIMIT ${query.limit}` : "";
      const sql = `SELECT ${fields} FROM "${table}" ${where} ${sort} ${limit}`;
      log().green().data("sql:", sql, values);

      const result = await pool.query<S & { __watermark: number }>(sql, values);
      return result.rows.map(({ __watermark, ...state }) => ({
        state: state as any,
        watermark: __watermark
      }));
    },

    agg: async (query: AggQuery<S>) => {
      const keys = Object.entries(query.select) as Array<[string, Agg[]]>;
      const aggs = keys.flatMap(([key, aggs]) =>
        aggs.map(
          (agg) =>
            [key, agg, `${agg}("${key}")`] satisfies [string, Agg, string]
        )
      );
      const values: any[] = [];
      const where = query.where
        ? "WHERE ".concat(filter(query.where, values))
        : "";
      const sql = `SELECT ${aggs
        .map(([key, agg, fn]) => `${fn} AS ${agg}_${key}`)
        .join(", ")} FROM "${table}" ${where}`;
      log().green().data("sql:", sql, values);

      const row = (await pool.query(sql, values)).rows.at(0) ?? {};
      return aggs.reduce(
        (result, [key, agg]) =>
          patch(result, { [key]: { [agg]: row[`${agg}_${key}`] } }),
        {}
      );
    }
  };

  logAdapterCreated(store.name);
  dispose(() => {
    if (store.dispose) {
      logAdapterDisposed(store.name);
      return store.dispose();
    }
    return Promise.resolve();
  });

  return store;
};
