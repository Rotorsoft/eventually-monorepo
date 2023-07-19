import { randomUUID } from "crypto";
import type { Store, StoreStat, Lease, Subscription } from "../interfaces";
import type {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Messages
} from "../types";
import { ConcurrencyError, ActorConcurrencyError } from "../types";

/**
 * @category Adapters
 * @remarks In-memory event store
 */
export const InMemoryStore = (): Store => {
  const _events: CommittedEvent[] = [];
  const _subscriptions: Record<string, Subscription> = {};

  const query = async <E extends Messages>(
    callback: (event: CommittedEvent<E>) => void,
    query?: AllQuery
  ): Promise<number> => {
    const {
      stream,
      names,
      before,
      after = -1,
      limit,
      created_before,
      created_after,
      actor,
      correlation
    } = query || {};
    let i = after + 1,
      count = 0;
    while (i < _events.length) {
      const e = _events[i++] as CommittedEvent<E>;
      if (stream && e.stream !== stream) continue;
      if (actor && e.metadata?.causation?.command?.actor?.id !== actor)
        continue;
      if (names && !names.includes(e.name)) continue;
      if (correlation && e.metadata?.correlation !== correlation) continue;
      if (created_after && e.created <= created_after) continue;
      if (before && e.id >= before) break;
      if (created_before && e.created >= created_before) break;
      callback(e);
      if (limit && ++count >= limit) break;
    }
    return Promise.resolve(count);
  };

  return {
    name: "InMemoryStore",
    dispose: () => {
      _events.length = 0;
      return Promise.resolve();
    },
    seed: () => Promise.resolve(),
    query,

    commit: <E extends Messages>(
      stream: string,
      events: Message<E>[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number
    ): Promise<CommittedEvent<E>[]> => {
      // stream concurrency
      const aggregate = _events.filter((e) => e.stream === stream);
      if (expectedVersion && aggregate.length - 1 !== expectedVersion)
        throw new ConcurrencyError(
          aggregate.length - 1,
          events,
          expectedVersion
        );

      // actor concurrency - this should never happen in memory
      const expectedCount = metadata.causation.command?.actor?.expectedCount;
      if (expectedCount) {
        const actor = metadata.causation.command?.actor;
        const count = _events.filter(
          (e) => e.metadata.causation.command?.actor?.id === actor?.id
        ).length;
        if (count !== expectedCount)
          throw new ActorConcurrencyError(
            `${actor.name}:${actor.id}`,
            events.at(0) as Message,
            count,
            expectedCount
          );
      }

      let version = aggregate.length;
      const committed = events.map(({ name, data }) => {
        const committed: CommittedEvent<E> = {
          id: _events.length,
          stream,
          version,
          created: new Date(),
          name,
          data,
          metadata
        };
        _events.push(committed);
        version++;
        return committed;
      });
      return Promise.resolve(committed);
    },

    reset: (): Promise<void> => {
      _events.length = 0;
      return Promise.resolve();
    },

    stats: (): Promise<StoreStat[]> => {
      const stats: Record<string, StoreStat> = {};
      _events.map((e) => {
        const stat: StoreStat = (stats[e.name] = stats[e.name] || {
          name: e.name,
          count: 0
        });
        stat.count++;
        stat.firstId = stat.firstId || e.id;
        stat.lastId = e.id;
        stat.firstCreated = stat.firstCreated || e.created;
        stat.lastCreated = e.created;
      });
      return Promise.resolve(Object.values(stats));
    },

    poll: async <E extends Messages>(
      consumer: string,
      names: string[],
      limit: number,
      timeout: number
    ): Promise<Lease<E> | undefined> => {
      const subscription: Subscription = (_subscriptions[consumer] =
        _subscriptions[consumer] || { consumer, watermark: -1 });

      // blocks competing consumers while existing lease is valid
      if (
        !(
          subscription.lease &&
          subscription.expires &&
          subscription.expires > new Date()
        )
      ) {
        // get events after watermark
        const events: Array<CommittedEvent<E>> = [];
        await query<E>((e) => events.push(e), {
          after: subscription.watermark,
          limit,
          names
        });

        // create a new lease when events found
        if (events.length) {
          const renew: Subscription = {
            consumer,
            watermark: subscription.watermark,
            lease: randomUUID(),
            expires: new Date(Date.now() + timeout)
          };
          _subscriptions[consumer] = renew;
          return { ...renew, events } as Lease<E>;
        }
      }
    },

    ack: <E extends Messages>(lease: Lease<E>, watermark?: number) => {
      const subscription = _subscriptions[lease.consumer];
      // updates subscription while lease is still valid
      if (
        subscription &&
        subscription.lease &&
        subscription.lease === lease.lease &&
        subscription.expires &&
        subscription.expires > new Date()
      ) {
        _subscriptions[lease.consumer] = {
          consumer: lease.consumer,
          watermark: Math.max(watermark || -1, subscription.watermark)
        };
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },

    subscriptions: () => Promise.resolve(Object.values(_subscriptions))
  };
};
