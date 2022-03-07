import {
  Subscription,
  SubscriptionStore,
  TriggerCallback
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { PostgresStreamListener } from "./PostgresStreamListener";
import { config } from "./config";

/*
select * from public.subscriptions;

insert into subscriptions(id, channel, streams, names, endpoint) 
values('counter1', 'calculator', '^Calculator-.+$', '^DigitPressed|DotPressed|EqualsPressed$', 'http://localhost:3000/counter');	

update subscriptions set active=false where id='stateless-counter1';
*/

const create_script = (table: string): string => `
create table if not exists public.${table}
(
  id character varying(100) not null primary key,
  active boolean not null default true,
  channel character varying(100) not null,
  streams character varying(150) not null,
  names character varying(250) not null,
  endpoint character varying(100) not null,
  position integer not null default -1
) tablespace pg_default;

create or replace function notify_subscription() returns trigger as
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
    'operation',TG_OP,
    'id',rec.id
  );
  perform pg_notify('subscriptions', payload);
  return rec;
end;
$trigger$ language plpgsql;

drop trigger if exists on_subscription_inserted_deleted on public.${table};
create trigger on_subscription_inserted_deleted after INSERT or DELETE on public.${table} for each row
execute procedure public.notify_subscription();

drop trigger if exists on_subscription_updated on public.${table};
create trigger on_subscription_updated after UPDATE on public.${table} for each row
when ((OLD.streams, OLD.names, OLD.endpoint) is distinct from (NEW.streams, NEW.names, NEW.endpoint) )
execute procedure public.notify_subscription();
`;

export const PostgresSubscriptionStore = (
  table?: string
): SubscriptionStore => {
  let pool: Pool;
  table = table || "subscriptions";

  return {
    init: async () => {
      if (!pool) {
        pool = new Pool(config.pg);
        await pool.query(create_script(table));
      }
    },

    listen: async (
      subscription: Subscription,
      callback: TriggerCallback
    ): Promise<void> => {
      await PostgresStreamListener(subscription, callback);
    },

    close: async () => {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },

    load: async (id?: string): Promise<Subscription[]> => {
      const result = id
        ? await pool.query<Subscription>(
            `select * from public.${table} where id=$1`,
            [id]
          )
        : await pool.query<Subscription>(
            `select * from public.${table} where active=true`
          );
      return result.rows;
    },

    commit: async (id: string, position: number): Promise<void> => {
      // TODO: use optimistic concurrency strategy - pass expectedPosition?
      // TODO: or try leasing strategy?
      await pool.query(
        `update public.${table} set position=$2 where id=$1 and position<$2`,
        [id, position]
      );
    }
  };
};
