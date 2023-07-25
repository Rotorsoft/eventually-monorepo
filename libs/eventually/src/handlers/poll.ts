import { log, store } from "../ports";
import type {
  EventHandlerFactory,
  EventResponse,
  Messages,
  State
} from "../types";
import event from "./event";
import type { Lease } from "../interfaces";

/**
 * Polls the `store` for committed events after the factory's `watermark`. This should be the entry
 * point to reactive service's event handlers.
 *
 * **Note**: Polls are serialized in order to avoid competing consumers from processing the same events more than once, but
 * consumers must be idempotent to accomodate potential failures and timeouts.
 *
 * > *Using a basic `leasing` strategy to get this working (distributed lock persisted in the store as subscriptions)*
 *
 * TODO: improve with Redis or some other efficient mechanism
 *
 * @param factory the event handler factory (policy, process manager, or projector)
 * @param names the event names to poll
 * @param limit the max number of events to poll
 * @param timeout the lease timeout in ms
 * @returns responses (including command or projection side effects), and error message when something failed
 */
export async function poll<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E>,
  names: string[],
  limit = 10,
  timeout = 5000
): Promise<EventResponse<S, C>[]> {
  let lease: Lease<E> | undefined;
  const responses: EventResponse<S, C>[] = [];
  let id = -1,
    error = undefined;

  try {
    lease = await store().poll<E>(factory.name, names, limit, timeout);
    if (lease)
      for (const e of lease.events) {
        id = e.id;
        responses.push(await event(factory, e));
      }
  } catch (err: any) {
    // just log - a retry mechanism should be implemented at a higher level
    log().error(err);
    error = err instanceof Error ? err.message : err.toString();
  } finally {
    if (lease) {
      const watermark = responses.at(-1)?.id;
      log().gray().trace(`\n>>> POLL-ACK ${factory.name}`, watermark, lease);
      const ok = await store().ack(lease, watermark);
      if (!ok) {
        const msg = `!!! POLL-ACK ${factory.name} failed on lease ${lease.lease} setting watermark ${watermark} - lease expired before ack?`;
        log().info(msg);
        error = (error ?? "").concat(msg);
      }
    }
  }
  error &&
    responses.push({
      id,
      error
    });
  return responses;
}

/**
 * Drains consumer subscription by polling events until the end of the stream is reached or an error occurs
 * @param factory the event handler factory (policy, process manager, or projector)
 * @param names the event names to poll
 * @param limit the max number of events to poll
 * @param timeout the lease timeout in ms
 * @returns number of handled events, and error message when something failed
 */
export async function drain<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E>,
  names: string[],
  limit = 10,
  timeout = 5000
): Promise<{ count: number; error?: string }> {
  let count = 0;
  let error: string | undefined = undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const responses = await poll(factory, names, limit, timeout);
    count += responses.length;
    if (responses.length < limit) break;
    error = responses.at(-1)?.error;
    if (error) break;
  }
  return { count, error };
}
