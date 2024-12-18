import {
  dispose,
  log,
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
      await pool.query(seed);
    },

    drop: async (): Promise<void> => {
      await pool.query(`DROP TABLE IF EXISTS "${table}"`);
    },

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
        m.stream || "",
        JSON.stringify(m.data)
      ]);

      await pool.query(sql, values);
      log().green().data("sql:", sql, values);
    },

    /**
     * Dequeues the oldest available message in the specified stream and passes it to the callback.
     * It uses a lock mechanism to ensure the message is only processed by one consumer at a time and
     * also makes sure that no other messages from the same stream can be dequeued while the message
     * is locked and being processed.
     */
    dequeue: async (callback, { stream }) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Only acquire advisory lock if stream is defined
        if (stream !== undefined) {
          const streamHash = BigInt(
            Buffer.from(stream).reduce(
              (acc, byte) => (acc * 31 + byte) & 0x7fffffff,
              0
            )
          );

          const { rows: lockResult } = await client.query(
            "SELECT pg_try_advisory_xact_lock($1) as acquired",
            [streamHash]
          );

          if (!lockResult[0].acquired) {
            await client.query("ROLLBACK");
            return false;
          }
        }

        // Use FOR UPDATE SKIP LOCKED for unstreamed messages to allow concurrent processing
        const { rows: next } = await client.query<
          Message<M> & { id: number; created: Date }
        >(
          `
          SELECT id, name, stream, data, created
          FROM "${table}"
          WHERE stream = $1
          ORDER BY created ASC, id ASC
          LIMIT 1
          ${stream === undefined ? "FOR UPDATE SKIP LOCKED" : "FOR UPDATE"}
          `,
          [stream || ""]
        );

        if (next.length === 0) {
          await client.query("ROLLBACK");
          return false;
        }

        const message = next[0];
        await callback(message);
        await client.query(`DELETE FROM "${table}" WHERE id = $1`, [
          message.id
        ]);
        await client.query("COMMIT");
        return true;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  };

  dispose(() => {
    if (queue.dispose) {
      return queue.dispose();
    }
    return Promise.resolve();
  });

  return queue;
};
