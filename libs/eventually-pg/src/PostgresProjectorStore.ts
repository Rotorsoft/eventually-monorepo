import type {
  Condition,
  Operator,
  ProjectorStore,
  State
} from "@rotorsoft/eventually";
import { dispose, log } from "@rotorsoft/eventually";
import { Pool, types } from "pg";
import { config } from "./config";
import { projector } from "./seed";

types.setTypeParser(types.builtins.INT8, (val) => parseInt(val, 10));
types.setTypeParser(types.builtins.FLOAT4, (val) => parseFloat(val));
types.setTypeParser(types.builtins.FLOAT8, (val) => parseFloat(val));
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));

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

    load: async (ids) => {
      const sql = `SELECT * FROM "${table}" WHERE id in (${ids
        .map((id) => `'${id}'`)
        .join(", ")})`;
      log().gray().trace(sql);

      const result = await pool.query<S & { __watermark: number }>(sql);
      return result.rows.map(({ __watermark, ...state }) => {
        return {
          state: state as any,
          watermark: __watermark
        };
      });
    },

    commit: async (map, watermark) => {
      const upserts: Array<{ sql: string; vals: any[] }> = [];
      const deletes: string[] = [];
      map.forEach((patch) => {
        if (patch.id) {
          const vals = Object.entries(patch).filter(([key]) => key !== "id");
          if (vals.length) {
            const sql = `INSERT INTO "${table}"(id, ${vals
              .map(([k]) => `"${k}"`)
              .join(", ")}, __watermark) VALUES('${patch.id}', ${vals
              .map((_, index) => `$${index + 1}`)
              .join(", ")}, ${watermark}) ON CONFLICT (id) DO UPDATE SET ${vals
              .map(([k], index) => `"${k}"=$${index + 1}`)
              .join(
                ", "
              )}, __watermark=${watermark} WHERE "${table}".__watermark < ${watermark} AND "${table}".id='${
              patch.id
            }'`;
            upserts.push({ sql, vals: vals.map(([, v]) => v) });
          } else
            deletes.push(
              `DELETE FROM "${table}" WHERE "${table}".__watermark < ${watermark} AND "${table}".id='${patch.id}'`
            );
        }
      });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let upserted = 0;
        for (const { sql, vals } of upserts) {
          upserted += (await client.query(sql, vals)).rowCount;
        }
        const deleted = (await client.query(deletes.join("\n"))).rowCount ?? 0;
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
        ? "WHERE ".concat(
            Object.entries(query.where)
              .map(([key, condition]: [string, Condition<any>], index) => {
                const { operator, value }: { operator: Operator; value: any } =
                  typeof condition === "object" && "operator" in condition
                    ? condition
                    : { operator: "eq", value: condition };
                const operation =
                  value === null
                    ? EQUALS.includes(operator)
                      ? "is null"
                      : "is not null"
                    : `${OPS[operator]} $${index + 1}`;
                value && values.push(value);
                return `"${key}" ${operation}`;
              })
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
      const limit = query.limit ? `LIMIT ${query.limit}` : "";
      const sql = `SELECT ${fields} FROM "${table}" ${where} ${sort} ${limit}`;
      log().gray().trace(sql, values);

      const result = await pool.query<S & { __watermark: number }>(sql, values);
      return result.rows.map(({ __watermark, ...state }) => ({
        state: state as any,
        watermark: __watermark
      }));
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
