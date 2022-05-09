import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  ConcurrencyError,
  log,
  Message,
  Payload,
  Store,
  StoreStat
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";
import { stream } from "./seed";

type Event = {
  id: number;
  name: string;
  data: any;
  stream: string;
  version: number;
  created: Date;
  metadata: any;
};

export const PostgresStore = (table: string): Store => {
  const pool = new Pool(config.pg);

  return {
    name: `PostgresStore:${table}`,
    dispose: async () => {
      await pool.end();
    },

    seed: async () => {
      await pool.query(stream(table));
    },

    query: async (
      callback: (event: CommittedEvent<string, Payload>) => void,
      query?: AllQuery
    ): Promise<number> => {
      const {
        stream,
        names,
        before,
        after = -1,
        limit,
        created_before,
        created_after,
        backward
      } = query;

      const values: any[] = [after];
      let sql = `SELECT * FROM ${table} WHERE id>$1`;
      if (stream) {
        values.push(stream);
        sql = sql.concat(` AND stream=$${values.length}`);
      }
      if (names && names.length) {
        values.push(names);
        sql = sql.concat(` AND name = ANY($${values.length})`);
      }
      if (before) {
        values.push(before);
        sql = sql.concat(` AND id<$${values.length}`);
      }
      if (created_after) {
        values.push(created_after.toISOString());
        sql = sql.concat(` AND created>$${values.length}`);
      }
      if (created_before) {
        values.push(created_before.toISOString());
        sql = sql.concat(` AND created<$${values.length}`);
      }
      sql = sql.concat(` ORDER BY id ${backward ? "DESC" : "ASC"}`);
      if (limit) {
        values.push(limit);
        sql = sql.concat(` LIMIT $${values.length}`);
      }

      const result = await pool.query<Event>(sql, values);
      result.rows.map((e) => callback(e as CommittedEvent<string, Payload>));

      return result.rowCount;
    },

    commit: async (
      stream: string,
      events: Message<string, Payload>[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number
    ): Promise<CommittedEvent<string, Payload>[]> => {
      const client = await pool.connect();
      let version = -1;
      try {
        await client.query("BEGIN");
        const last = await client.query<Event>(
          `SELECT version FROM ${table} WHERE stream=$1 ORDER BY version DESC LIMIT 1`,
          [stream]
        );
        version = last.rowCount ? last.rows[0].version : -1;
        if (expectedVersion && version !== expectedVersion)
          throw new ConcurrencyError(version, events, expectedVersion);

        const committed = await Promise.all(
          events.map(async ({ name, data }) => {
            version++;
            const committed = await client.query<Event>(
              `INSERT INTO ${table}(name, data, stream, version, metadata)
          VALUES($1, $2, $3, $4, $5) RETURNING *`,
              [name, data, stream, version, metadata]
            );
            return committed.rows[0] as CommittedEvent<string, Payload>;
          })
        );

        await client
          .query(
            `
            NOTIFY ${table}, '${JSON.stringify({
              operation: "INSERT",
              id: committed[0].name,
              position: committed[0].id
            })}';
            COMMIT;
            `
          )
          .catch((error) => {
            log().error(error);
            throw new ConcurrencyError(version, events, expectedVersion);
          });
        return committed;
      } catch (error) {
        log().error(error);
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    stats: async (): Promise<StoreStat[]> => {
      const sql = `SELECT 
          name, 
          MIN(id) as firstId, 
          MAX(id) as lastId, 
          MIN(created) as firstCreated, 
          MAX(created) as lastCreated, 
          COUNT(*) as count
        FROM 
          ${table}
        GROUP BY 
          name
        ORDER BY 
          5 DESC`;

      return (await pool.query<StoreStat>(sql)).rows;
    }
  };
};
