import { config } from "@rotorsoft/eventually-pg";
import { Pool } from "pg";
import {
  PostgresStreamListenerFactory,
  Service,
  Subscription,
  SubscriptionStore
} from "..";

const create_script = (): string => `
create table if not exists public.services (
  id varchar(100) primary key,
  channel varchar(100) not null,
  url varchar(100) not null
) tablespace pg_default;

create table if not exists public.subscriptions (
  id varchar(100) primary key,
  active boolean not null default true,
  producer varchar(100) not null,
  consumer varchar(100) not null,
  path varchar(100) not null,
  streams varchar(100) not null,
  names varchar(250) not null,
  position integer not null default -1,
  constraint fk_producer_service foreign key(producer) references services(id),
  constraint fk_consumer_service foreign key(consumer) references services(id)
) tablespace pg_default;

create or replace function notify() returns trigger as
$trigger$
declare
  rec record;
  payload text;
begin
  case TG_OP
    when 'UPDATE' then rec := NEW;
    when 'INSERT' then rec := NEW;
    when 'DELETE' then rec := OLD;
  end case;
  payload := json_build_object(
    'operation', TG_OP,
    'id', rec.id
  );
  perform pg_notify(TG_TABLE_NAME, payload);
  return rec;
end;
$trigger$ language plpgsql;

drop trigger if exists on_service_inserted_deleted on public.services;
create trigger on_service_inserted_deleted after INSERT or DELETE on public.services for each row
execute procedure public.notify();

drop trigger if exists on_service_updated on public.services;
create trigger on_service_updated after UPDATE on public.services for each row
when (
  (OLD.channel, OLD.url) is distinct from
  (NEW.channel, NEW.url)
)
execute procedure public.notify();

drop trigger if exists on_subscription_inserted_deleted on public.subscriptions;
create trigger on_subscription_inserted_deleted after INSERT or DELETE on public.subscriptions for each row
execute procedure public.notify();

drop trigger if exists on_subscription_updated on public.subscriptions;
create trigger on_subscription_updated after UPDATE on public.subscriptions for each row
when (
  (OLD.active, OLD.path, OLD.streams, OLD.names) is distinct from
  (NEW.active, NEW.path, NEW.streams, NEW.names)
)
execute procedure public.notify();
`;

export const PostgresSubscriptionStore = (): SubscriptionStore => {
  let pool: Pool;

  return {
    init: async (seed = false) => {
      if (!pool) {
        pool = new Pool(config.pg);
        seed && (await pool.query(create_script()));
      }
      return PostgresStreamListenerFactory;
    },

    close: async () => {
      if (pool) {
        await pool.end();
        pool = null;
      }
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
