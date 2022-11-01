import { config } from "@rotorsoft/eventually-pg";
import { Pool, types } from "pg";
import {
  PostgresStreamListener,
  Service,
  Subscription,
  SubscriptionStore
} from "..";
import { seed } from "./seed";

types.setTypeParser(types.builtins.INT8, (val) => parseInt(val, 10));

export const PostgresSubscriptionStore = (): SubscriptionStore => {
  const pool = new Pool(config.pg);
  const servicesListener = PostgresStreamListener("services");
  const subscriptionsListener = PostgresStreamListener("subscriptions");

  return {
    name: "PostgresSubscriptionStore",
    dispose: async () => {
      await servicesListener.close();
      await subscriptionsListener.close();
      await pool.end();
    },

    seed: async () => {
      await pool.query(seed());
    },

    listen: async (servicesCallback, subscriptionsCallback) => {
      await Promise.all([
        servicesListener.listen(servicesCallback),
        subscriptionsListener.listen(subscriptionsCallback)
      ]);
    },

    loadServices: async (id?: string): Promise<Service[]> => {
      const result = id
        ? await pool.query<Service>(
            "select * from public.services where id=$1 limit 100",
            [id]
          )
        : await pool.query<Service>("select * from public.services limit 100");
      return result.rows;
    },

    createService: async ({ id, channel, url }): Promise<void> => {
      await pool.query(
        "insert into public.services(id, channel, url) values($1, $2, $3)",
        [id, channel, url]
      );
    },

    updateService: async ({ id, channel, url }): Promise<void> => {
      await pool.query(
        "update public.services set channel=$2, url=$3 where id=$1",
        [id, channel, url]
      );
    },

    deleteService: async (id: string): Promise<void> => {
      await pool.query("delete from public.services where id=$1", [id]);
    },

    commitServicePosition: async (
      id: string,
      position: number
    ): Promise<void> => {
      await pool.query(
        "update public.services set position=greatest(position, $2), updated=now() where id=$1",
        [id, position]
      );
    },

    loadSubscriptions: async (id?: string): Promise<Subscription[]> => {
      const result = id
        ? await pool.query<Subscription>(
            `select s.*, concat(c.url, '/', s.path) as endpoint
            from public.subscriptions s join public.services c on s.consumer = c.id
            where s.id=$1
            limit 100`,
            [id]
          )
        : await pool.query<Subscription>(
            `select s.*, concat(c.url, '/', s.path) as endpoint
            from public.subscriptions s join public.services c on s.consumer = c.id
            limit 100`
          );
      return result.rows;
    },

    loadSubscriptionsByProducer: async (
      producer: string
    ): Promise<Subscription[]> => {
      const result = await pool.query<Subscription>(
        `select s.*, concat(c.url, '/', s.path) as endpoint
        from public.subscriptions s join public.services c on s.consumer = c.id
        where s.producer=$1`,
        [producer]
      );
      return result.rows;
    },

    searchSubscriptions: async (pattern: string): Promise<Subscription[]> => {
      const result = await pool.query<Subscription>(
        `select s.*, concat(c.url, '/', s.path) as endpoint
        from public.subscriptions s join public.services c on s.consumer = c.id
        where
          s.id ~* $1
          or s.producer ~* $1
          or s.consumer ~* $1
          or s.path ~* $1
          or s.streams ~* $1
          or s.names ~* $1
        limit 100`,
        [pattern]
      );
      return result.rows;
    },

    createSubscription: async ({
      id,
      producer,
      consumer,
      path,
      streams,
      names,
      batch_size,
      retries,
      retry_timeout_secs
    }): Promise<void> => {
      await pool.query(
        `insert into public.subscriptions(id, active, producer, consumer, path, streams, names, batch_size, retries, retry_timeout_secs)
        values($1, false, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          producer,
          consumer,
          path,
          streams,
          names,
          batch_size,
          retries,
          retry_timeout_secs
        ]
      );
    },

    updateSubscription: async ({
      id,
      producer,
      consumer,
      path,
      streams,
      names,
      batch_size,
      retries,
      retry_timeout_secs
    }): Promise<void> => {
      await pool.query(
        "update public.subscriptions set producer=$2, consumer=$3, path=$4, streams=$5, names=$6, batch_size=$7, retries=$8, retry_timeout_secs=$9 where id=$1",
        [
          id,
          producer,
          consumer,
          path,
          streams,
          names,
          batch_size,
          retries,
          retry_timeout_secs
        ]
      );
    },

    deleteSubscription: async (id: string): Promise<void> => {
      await pool.query("delete from public.subscriptions where id=$1", [id]);
    },

    toggleSubscription: async (id: string): Promise<void> => {
      await pool.query(
        "update public.subscriptions set active=not active where id=$1",
        [id]
      );
    },

    commitSubscriptionPosition: async (
      id: string,
      position: number
    ): Promise<void> => {
      /** 
        TODO: 
          WARNING!!!: We don't support multiple brokers handling the same subscription store
          In the future we can use optimistic concurrency or leasing strategies
      */
      await pool.query(
        "update public.subscriptions set position=greatest(position, $2), updated=now() where id=$1",
        [id, position]
      );
    }
  };
};
