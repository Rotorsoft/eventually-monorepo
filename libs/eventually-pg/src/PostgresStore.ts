import { Pool } from "pg";
import { Store, CommittedEvent, Message, Payload } from "@rotorsoft/eventually";
import { config } from "./config";

const pool = new Pool(config.pg);

type Event = {
  event_id: number;
  event_name: string;
  event_data: any;
  aggregate_id: string;
  aggregate_version: number;
  created_at: Date;
};

type Subscription = {
  id: string;
  event: string;
  cursor: number;
};

export const PostgresStore = (): Store => ({
  load: async (
    id: string,
    reducer: (event: CommittedEvent<string, Payload>) => void
  ): Promise<void> => {
    const events = await pool.query<Event>(
      "SELECT * FROM events WHERE aggregate_id=$1 ORDER BY aggregate_version",
      [id]
    );
    events.rows.map((e) =>
      reducer({
        eventId: e.event_id,
        aggregateId: e.aggregate_id,
        aggregateVersion: e.aggregate_version.toString(),
        createdAt: e.created_at,
        name: e.event_name,
        data: e.event_data
      })
    );
  },

  commit: async (
    id: string,
    { name, data }: Message<string, Payload>,
    expectedVersion?: string
  ): Promise<CommittedEvent<string, Payload>> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const last = await client.query<Event>(
        "SELECT aggregate_version FROM events WHERE aggregate_id=$1 ORDER BY aggregate_version DESC LIMIT 1",
        [id]
      );
      let version = last.rowCount ? last.rows[0].aggregate_version : -1;
      if (expectedVersion && version.toString() !== expectedVersion)
        throw Error("Concurrency Error");
      version++;
      const committed = await client.query<Event>(
        `INSERT INTO events(event_name, event_data, aggregate_id, aggregate_version)
        VALUES($1, $2, $3, $4) RETURNING event_id, created_at`,
        [name, data, id, version]
      );
      await client.query("COMMIT");
      const { event_id, created_at } = committed.rows[0];
      return {
        eventId: event_id,
        aggregateId: id,
        aggregateVersion: version.toString(),
        createdAt: created_at,
        name,
        data
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  subscribe: async (event: string, from?: number): Promise<string> => {
    const subscription = await pool.query<Subscription>(
      `INSERT INTO subscriptions(event, cursor) VALUES($1, $2) RETURNING id`,
      [event, from || -1]
    );
    return subscription.rows[0].id;
  },

  poll: async (
    subscription: string,
    limit = 1
  ): Promise<CommittedEvent<string, Payload>[]> => {
    const sub = await pool.query<Subscription>(
      `SELECT * FROM subscriptions WHERE id=$1`,
      [subscription]
    );
    if (!sub.rowCount) throw Error(`Subscription ${subscription} not found`);
    const { event, cursor } = sub.rows[0];

    const events = await pool.query<Event>(
      "SELECT * FROM events WHERE event_name = $1 AND event_id > $2 ORDER BY event_id LIMIT $3",
      [event, cursor, limit]
    );

    return events.rows.map((e) => ({
      eventId: e.event_id,
      aggregateId: e.aggregate_id,
      aggregateVersion: e.aggregate_version.toString(),
      createdAt: e.created_at,
      name: e.event_name,
      data: e.event_data
    }));
  },

  ack: async (subscription: string, id: number): Promise<boolean> => {
    // TODO review concurrency
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query<Subscription>(
        `UPDATE subscriptions SET cursor = $2 WHERE id = $1 AND cursor < $2 RETURNING cursor`,
        [subscription, id]
      );
      await client.query("COMMIT");
      return updated.rowCount > 0;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
});
