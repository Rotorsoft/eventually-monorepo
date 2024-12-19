import {
  dispose,
  log,
  Message,
  MessageQueue,
  Messages
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { pid } from "process";
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
     * Dequeues and pocesses the oldest message from the queue.  The entire stream is locked
     * during processing and no other consumers will be able to dequeue messages from the same stream
     * until the message is processed and deleted from the queue.
     * @param callback consumer callback that receives the message with storage attributes
     *   {id, created} and returns a promise<void> or throws an error
     * @param opts options for dequeuing
     * @param opts.stream optional stream name, if a stream is not specified then the oldest message from the queue is dequeued.
     *   If a stream is specified then the oldest message from that stream is dequeued.
     *   The entire stream of the dequeued message is locked during processing in either case.
     * @param opts.leaseMillis optional lease duration in milliseconds before lock expires (default: 30000)
     * @returns promise that resolves true when message is successfully processed, resolves false when
     *   stream/queue is empty or lock cannot be acquired, rejects when message is not processed
     */
    dequeue: async (callback, opts) => {
      const { stream, leaseMillis = 30000 } = opts;
      const client = await pool.connect();
      let acquiredMessage:
        | (Message<M> & { id: number; created: Date })
        | undefined;
      let acquisitionTxnActive = false;

      try {
        // First transaction: try to acquire a message
        await client.query("BEGIN");
        acquisitionTxnActive = true;
        const { rows: next } = await client.query<
          Message<M> & { id: number; created: Date }
        >(
          `WITH lockable_message AS (
             SELECT t.id, t.name, t.stream, t.data, t.created
             FROM "${table}" t
             WHERE t.stream = COALESCE($1, t.stream)
             AND NOT EXISTS (
               SELECT 1 FROM "${table}" t2
               WHERE t2.stream = t.stream
               AND t2.locked_by IS NOT NULL
               AND t2.locked_until > NOW()
             )
             AND (t.locked_by IS NULL OR t.locked_until <= NOW())
             ORDER BY t.created ASC, t.id ASC
             LIMIT 1
             FOR UPDATE
           )
           UPDATE "${table}" t
           SET locked_by = $2,
               locked_until = NOW() + ($3 || ' milliseconds')::interval
           FROM lockable_message l
           WHERE t.id = l.id
           RETURNING t.id, t.name, t.stream, t.data, t.created`,
          [stream || "", pid, leaseMillis]
        );

        if (next.length === 0) {
          await client.query("ROLLBACK");
          acquisitionTxnActive = false;
          return false;
        }

        await client.query("COMMIT");
        acquisitionTxnActive = false;
        acquiredMessage = next[0];

        // if we got here then we have the stream lock
        // process and delete the message
        try {
          await callback(acquiredMessage);

          // now delete the message, and make sure we still had the stream lock
          // due to our locking mechanism no other process should have updated this message
          const result = await client.query(
            `DELETE FROM "${table}" WHERE id = $1 AND locked_by = $2`,
            [acquiredMessage.id, pid]
          );

          return (result.rowCount ?? 0) > 0;
        } catch (err) {
          // Try to explicitly release the lock, but don't worry if it fails - locked_until is the fallback
          try {
            await client.query(
              `UPDATE "${table}" 
               SET locked_by = NULL, 
                   locked_until = NULL 
               WHERE id = $1 
               AND locked_by = $2`,
              [acquiredMessage.id, pid]
            );
          } catch {
            // Ignore cleanup errors - locked_until is the fallback
          }
          throw err;
        }
      } catch (err) {
        // Handle any active transaction
        if (acquisitionTxnActive) {
          await client.query("ROLLBACK").catch(() => {});
        }
        throw err;
      } finally {
        client.release();
      }
    }
  };

  dispose(() => queue.dispose?.());

  return queue;
};
