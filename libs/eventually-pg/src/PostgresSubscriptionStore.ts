import type {
  CommittedEvent,
  Lease,
  Messages,
  PollOptions,
  Subscription,
  SubscriptionStore
} from "@rotorsoft/eventually";
import { dateReviver, log, store } from "@rotorsoft/eventually";
import { randomUUID } from "crypto";
import { Pool, types } from "pg";
import { config } from "./config";
import { subscription } from "./seed";

types.setTypeParser(types.builtins.JSON, (val) => JSON.parse(val, dateReviver));

export const PostgresSubscriptionStore = (table: string): SubscriptionStore => {
  const pool = new Pool(config.pg);

  return {
    name: `PostgresSubscriptionStore:${table}`,
    dispose: async () => {
      await pool.end();
    },

    seed: async () => {
      const seed = subscription(table);
      log().yellow().info(`>>> Seeding subscription store: ${table}`);
      log().gray().info(seed);
      await pool.query(seed);
    },

    drop: async (): Promise<void> => {
      await pool.query(`DROP TABLE IF EXISTS "${table}"`);
    },

    poll: async <E extends Messages>(
      consumer: string,
      { names, timeout, limit }: PollOptions
    ): Promise<Lease<E> | undefined> => {
      const client = await pool.connect();
      try {
        const events: CommittedEvent<E>[] = [];
        let lease, expires;

        await client.query("BEGIN");
        const { rows } = await pool.query<Subscription>(
          `SELECT * FROM "${table}" WHERE consumer=$1`,
          [consumer]
        );
        const subscription =
          rows.at(0) || ({ consumer, watermark: -1 } as Subscription);
        // block competing consumers while existing lease is valid
        if (
          !(
            subscription.lease &&
            subscription.expires &&
            subscription.expires > new Date()
          )
        ) {
          // get events after watermark
          await store().query<E>((e) => events.push(e), {
            after: subscription.watermark,
            limit,
            names
          });

          // create a new lease when events found
          if (events.length) {
            lease = randomUUID();
            expires = new Date(Date.now() + timeout);
            const sql = `INSERT INTO "${table}" VALUES($1, $2, $3, $4) ON CONFLICT (consumer) DO UPDATE SET lease=$3, expires=$4 WHERE "${table}".consumer=$1`;
            const vals = [consumer, subscription.watermark, lease, expires];
            log().silver().data(sql, vals);
            await client.query(sql, vals);
          }
        }
        await client.query("COMMIT");
        return events.length
          ? ({
              consumer,
              watermark: subscription.watermark,
              lease,
              expires,
              events
            } as Lease<E>)
          : undefined;
      } catch (error) {
        log().error(error);
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    ack: async <E extends Messages>(lease: Lease<E>, watermark: number) => {
      let acked = false;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await pool.query<Subscription>(
          `SELECT * FROM "${table}" WHERE consumer=$1`,
          [lease.consumer]
        );
        const subscription =
          rows.at(0) ||
          ({ consumer: lease.consumer, watermark: -1 } as Subscription);
        // update watermark while lease is still valid
        if (
          subscription.lease &&
          subscription.lease === lease.lease &&
          subscription.expires &&
          subscription.expires > new Date()
        ) {
          const sql = `UPDATE "${table}" SET watermark=$2, lease=null, expires=null WHERE "${table}".consumer=$1`;
          const vals = [lease.consumer, watermark];
          acked = ((await client.query(sql, vals)).rowCount ?? 0) > 0;
          log().silver().data(sql, vals, { acked });
        }
        await client.query("COMMIT");
      } catch (error) {
        log().error(error);
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return acked;
    },

    subscriptions: async () => {
      const { rows } = await pool.query<Subscription>(
        `SELECT * FROM "${table}"`
      );
      return rows;
    }
  };
};
