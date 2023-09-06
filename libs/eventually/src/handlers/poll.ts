import { app, log, store } from "../ports";
import type {
  EventHandlerFactory,
  Lease,
  Messages,
  PollOptions,
  ProjectorFactory,
  State
} from "../types";
import event from "./event";
import project from "./project";

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
 * @param timeout the lease timeout in ms
 * @param limit the max number of events to poll
 * @returns number of handled events, and error message when something fails
 */
export async function poll<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E> | ProjectorFactory<S, E>,
  options: PollOptions
): Promise<{ count: number; error?: string }> {
  const md = app().artifacts.get(factory.name);
  if (
    md?.type !== "policy" &&
    md?.type !== "process-manager" &&
    md?.type !== "projector"
  )
    return { count: 0 };

  let lease: Lease<E> | undefined;
  let count = 0;
  let error = undefined;
  let watermark = -1;

  try {
    lease = await store().poll<E>(factory.name, options);
    if (lease) {
      log().gray().trace(`\n>>> POLL-ACK ${factory.name}`, lease);
      watermark = lease.watermark;
      if (md.type === "projector") {
        await project(factory as ProjectorFactory<S, E>, lease.events);
        watermark = lease.events.at(-1)?.id ?? watermark;
        count = lease.events.length;
      } else {
        for (const e of lease.events) {
          await event(factory as EventHandlerFactory<S, C, E>, e);
          watermark = e.id;
          count++;
        }
      }
    }
  } catch (err: any) {
    // just log - a retry mechanism should be implemented at a higher level
    log().error(err);
    error = err instanceof Error ? err.message : err.toString();
  } finally {
    if (lease) {
      const ok = await store().ack(lease, watermark);
      if (!ok) {
        const msg = `!!! POLL-ACK ${factory.name} failed on lease ${lease.lease} setting watermark ${watermark}. Might need to increase lease timeout`;
        log().info(msg);
        error = (error ?? "").concat(msg);
      }
    }
  }
  return { count, error };
}

/**
 * Drains consumer subscription by polling events until the end of the stream is reached or an error occurs
 * @param factory event handler factory (policy, process manager, or projector)
 * @param options poll options
 * @returns number of handled events, and error message when something fails
 */
export async function drain<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E> | ProjectorFactory<S, E>,
  options: PollOptions
): Promise<{ total: number; times: number; error?: string }> {
  let total = 0,
    times = 0;
  while (times < (options.times ?? 1000)) {
    const { count, error } = await poll(factory, options);
    total += count;
    times++;
    if (count < options.limit) break;
    if (error) return { total, times, error };
  }
  return { total, times };
}
