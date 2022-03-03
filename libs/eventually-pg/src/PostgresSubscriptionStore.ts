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
CREATE TABLE IF NOT EXISTS public.${table}
(
  id character varying(100) COLLATE pg_catalog."default" NOT NULL PRIMARY KEY,
  active boolean NOT NULL default true,
  channel character varying(100) COLLATE pg_catalog."default" NOT NULL,
  streams character varying(150) COLLATE pg_catalog."default" NOT NULL,
  names character varying(250) COLLATE pg_catalog."default" NOT NULL,
  endpoint character varying(100) COLLATE pg_catalog."default" NOT NULL,
  position integer NOT NULL default -1
) TABLESPACE pg_default;`;

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

    listen: (
      subscription: Subscription,
      callback: TriggerCallback
    ): Promise<void> => {
      void PostgresStreamListener(subscription, callback);
      return;
    },

    close: async () => {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },

    load: async (): Promise<Subscription[]> => {
      const result = await pool.query<Subscription>(
        `select * from ${table} where active=true`
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
