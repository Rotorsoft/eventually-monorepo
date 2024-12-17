import {
  dispose,
  log,
  logAdapterCreated,
  logAdapterDisposed,
  Message,
  MessageQueue,
  Messages
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { config } from "./config";
import { message_queue } from "./seed";

export const PostgresMessageQueue = <M extends Messages>(
  table: string
): MessageQueue<M> => {
  const pool = new Pool(config.pg);
  const queue: MessageQueue<M> = {
    name: `PostgresMessageQueue:${table}`,
    dispose: async () => {
      await pool.end();
    },

    seed: async () => {
      const seed = message_queue(table);
      log().green().info(`>>> Seeding message queue table: ${table}`);
      log().gray().info(seed);
      await pool.query(seed);
    },

    drop: async (): Promise<void> => {
      await pool.query(`DROP TABLE IF EXISTS "${table}"`);
    },

    /**
     * Enqueues messages into the table.
     * Each message should be inserted with its stream and a timestamp.
     */
    enqueue: async (messages) => {
      const N = 3;
      const sql = `
        INSERT INTO "${table}" (name, stream, data)
        VALUES ${messages
          .map(
            (_, i) =>
              `(${[...Array(N)].map((_, j) => `$${i * N + j + 1}`).join(", ")})`
          )
          .join(", ")}
      `;
      const values = messages.flatMap((m) => [
        m.name,
        m.stream || "", // empty stream for non-streamed messages
        JSON.stringify(m.data)
      ]);

      log().green().data("sql:", sql, values);
      await pool.query(sql, values);
    },

    /**
     * Dequeues the oldest available message in the specified stream and passes it to the callback.
     * It uses a lock mechanism to ensure the message is only processed by one consumer at a time.
     */
    dequeue: async (callback, { stream, leaseMillis = 30_000 }) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // select and lock the next message in the queue
        const { rows: next } = await client.query<
          Message<M> & { id: number; created: Date }
        >(
          `
          SELECT * FROM "${table}"
          WHERE stream = $1 AND (locked_until IS NULL OR locked_until < NOW())
          ORDER BY created ASC LIMIT 1
          FOR UPDATE SKIP LOCKED
        `,
          [stream]
        );
        if (next.length === 0) {
          log().yellow().trace(`No messages available for stream: ${stream}`);
          await client.query("ROLLBACK");
          return;
        }

        // update lock to prevent other consumers from accessing it
        const message = next[0];
        await client.query(
          `
          UPDATE "${table}" SET locked_until = NOW() + INTERVAL '1 millisecond' * $1
          WHERE id = $2
        `,
          [leaseMillis, message.id]
        );

        // process the message using the provided callback
        try {
          await callback(message);
          // delete message from the queue on success
          await client.query(`DELETE FROM "${table}" WHERE id = $1`, [
            message.id
          ]);
        } catch (err) {
          // release the lock on failure (no need for additional actions as lock will expire)
          log().red().error(err);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        log().red().error(err);
      } finally {
        client.release();
      }
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
