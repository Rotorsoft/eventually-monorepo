import { config } from "@rotorsoft/eventually-pg";
import { Pool } from "pg";
import {
  PostgresStreamListener,
  Service,
  Subscription,
  SubscriptionStore
} from "..";
import { seed } from "./seed";

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

    listen: (servicesCallback, subscriptionsCallback) => {
      servicesListener.listen(servicesCallback);
      subscriptionsListener.listen(subscriptionsCallback);
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

    loadSubscriptions: async (id?: string): Promise<Subscription[]> => {
      const result = id
        ? await pool.query<Subscription>(
            "select * from public.subscriptions where id=$1 limit 100",
            [id]
          )
        : await pool.query<Subscription>(
            "select * from public.subscriptions limit 100"
          );
      return result.rows;
    },

    loadSubscriptionsByProducer: async (
      producer: string
    ): Promise<Subscription[]> => {
      const result = await pool.query<Subscription>(
        "select * from public.subscriptions where producer=$1",
        [producer]
      );
      return result.rows;
    },

    searchSubscriptions: async (pattern: string): Promise<Subscription[]> => {
      const result = await pool.query<Subscription>(
        `select * from public.subscriptions
        where
          id ~* $1
          or producer ~* $1
          or consumer ~* $1
          or path ~* $1
          or streams ~* $1
          or names ~* $1
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
      names
    }): Promise<void> => {
      await pool.query(
        `insert into public.subscriptions(id, active, producer, consumer, path, streams, names)
        values($1, false, $2, $3, $4, $5, $6)`,
        [id, producer, consumer, path, streams, names]
      );
    },

    updateSubscription: async ({
      id,
      producer,
      consumer,
      path,
      streams,
      names
    }): Promise<void> => {
      await pool.query(
        "update public.subscriptions set producer=$2, consumer=$3, path=$4, streams=$5, names=$6 where id=$1",
        [id, producer, consumer, path, streams, names]
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

    commitPosition: async (id: string, position: number): Promise<void> => {
      /** 
        TODO: 
          WARNING!!!: We don't support multiple brokers handling the same subscription store
          In the future we can use optimistic concurrency or leasing strategies
      */
      await pool.query(
        "update public.subscriptions set position=$2 where id=$1",
        [id, position]
      );
    }
  };
};
