import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  ConcurrencyError,
  dateReviver,
  log,
  Message,
  Messages,
  Store,
  StoreStat
} from "@rotorsoft/eventually";
import { Pool, types } from "pg";
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

type Subscription = {
  consumer: string;
  watermark: number;
  lease?: string;
  expires?: Date;
};

types.setTypeParser(types.builtins.JSON, (val) => JSON.parse(val, dateReviver));

export const PostgresStore = (table: string): Store => {
  const pool = new Pool(config.pg);

  const query = async <E extends Messages>(
    callback: (event: CommittedEvent<E>) => void,
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
      backward,
      correlation
    } = query || {};

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
    if (correlation) {
      values.push(correlation);
      sql = sql.concat(` AND metadata->>'correlation'=$${values.length}`);
    }
    sql = sql.concat(` ORDER BY id ${backward ? "DESC" : "ASC"}`);
    if (limit) {
      values.push(limit);
      sql = sql.concat(` LIMIT $${values.length}`);
    }

    const result = await pool.query<Event>(sql, values);
    for (const row of result.rows) callback(row as CommittedEvent<E>);

    return result.rowCount;
  };

  return {
    name: `PostgresStore:${table}`,
    dispose: async () => {
      await pool.end();
    },

    seed: async () => {
      await pool.query(stream(table));
    },

    query,

    commit: async <E extends Messages>(
      stream: string,
      events: Message<E>[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number
    ): Promise<CommittedEvent<E>[]> => {
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
            return committed.rows[0] as CommittedEvent<E>;
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
            throw new ConcurrencyError(version, events, expectedVersion || -1);
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
    },

    poll: async <E extends Messages>(
      consumer: string,
      names: string[],
      limit: number,
      lease: string,
      timeout: number,
      callback: (event: CommittedEvent<E>) => void
    ) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await pool.query<Subscription>(
          `SELECT * FROM ${table}_subscriptions WHERE consumer=$1`,
          [consumer]
        );
        const subscription = rows.at(0) || ({ watermark: -1 } as Subscription);
        // block competing consumers while existing lease is valid
        if (
          !(
            subscription.lease &&
            subscription.expires &&
            subscription.expires > new Date()
          )
        ) {
          // create a new lease
          await client.query(
            `INSERT INTO ${table}_subscriptions VALUES($1, $2, $3, $4)
            ON CONFLICT (consumer) DO UPDATE SET lease=$3, expires=$4 WHERE ${table}_subscriptions.consumer=$1`,
            [
              consumer,
              subscription.watermark,
              lease,
              new Date(Date.now() + timeout)
            ]
          );
          // get events after watermark
          await query<E>((e) => callback(e), {
            after: subscription.watermark,
            limit,
            names
          });
        }
        await client.query("COMMIT");
      } catch (error) {
        log().error(error);
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    ack: async (consumer: string, lease: string, watermark: number) => {
      let acked = false;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await pool.query<Subscription>(
          `SELECT * FROM ${table}_subscriptions WHERE consumer=$1`,
          [consumer]
        );
        const subscription = rows.at(0) || ({ watermark: -1 } as Subscription);
        // update watermark while lease is still valid
        if (
          subscription.lease &&
          subscription.lease === lease &&
          subscription.expires &&
          subscription.expires > new Date()
        )
          acked =
            (
              await client.query(
                `UPDATE ${table}_subscriptions SET watermark=$2, lease=null, expires=null WHERE ${table}_subscriptions.consumer=$1`,
                [consumer, watermark]
              )
            ).rowCount > 0;
        await client.query("COMMIT");
      } catch (error) {
        log().error(error);
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return acked;
    }
  };
};
