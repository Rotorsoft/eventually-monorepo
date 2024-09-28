import {
  dispose,
  log,
  logAdapterCreated,
  logAdapterDisposed,
  MessageQueue,
  Messages
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";

export const PostgresMessageQueue = <M extends Messages>(
  table: string
): MessageQueue<M> => {
  const pool = new Pool(config.pg);
  const queue: MessageQueue<M> = {
    name: `PostgresMessageQueue:${table}`,
    dispose: async () => {
      await pool.end();
    },

    // TODO: implement
    enqueue: async (messages) => {
      const sql = `TODO INSERT`.concat(
        messages.map((message) => message.name).join(", ")
      );
      log().green().data("sql:", sql);
      await pool.query(sql);
    },

    // TODO: implement
    dequeue: async (callback, stream) => {
      const sql = `SELECT * FROM "${table}" WHERE stream = '${stream}' ORDER BY created ASC LIMIT 1`;
      log().green().data("sql:", sql);
      // const result = await pool.query(sql);
      // TODO: handle results with callback
      return Promise.resolve();
    },

    // TODO: implement
    seed: async () => {
      const seed = "TODO SEED";
      log().green().info(`>>> Seeding message queue table: ${table}`);
      log().gray().info(seed);
      await pool.query(seed);
    },

    drop: async (): Promise<void> => {
      await pool.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  };

  logAdapterCreated(queue.name);
  dispose(() => {
    if (queue.dispose) {
      logAdapterDisposed(queue.name);
      return queue.dispose();
    }
    return Promise.resolve();
  });

  return queue;
};
