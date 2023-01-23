import { Store, StoreStat } from "../interfaces";
import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  ConcurrencyError,
  Message,
  Messages
} from "../types";

export const InMemoryStore = (): Store => {
  const _events: CommittedEvent[] = [];
  const _subscriptions: Record<
    string,
    { watermark: number; lease?: string; expires?: Date }
  > = {};

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
      correlation
    } = query || {};
    let i = after + 1,
      count = 0;
    while (i < _events.length) {
      const e = _events[i++] as CommittedEvent<E>;
      if (stream && e.stream !== stream) continue;
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
      const aggregate = _events.filter((e) => e.stream === stream);
      if (expectedVersion && aggregate.length - 1 !== expectedVersion)
        throw new ConcurrencyError(
          aggregate.length - 1,
          events,
          expectedVersion
        );

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
      lease: string,
      timeout: number,
      callback: (event: CommittedEvent<E>) => void
    ) => {
      const subscription = _subscriptions[consumer] || { watermark: -1 };
      // block competing consumers while existing lease is valid
      if (
        !(
          subscription.lease &&
          subscription.expires &&
          subscription.expires > new Date()
        )
      ) {
        // create a new lease
        subscription.lease = lease;
        subscription.expires = new Date(Date.now() + timeout);
        // get events after watermark
        await query<E>((e) => callback(e), {
          after: subscription.watermark,
          limit,
          names
        });
      }
    },

    ack: (consumer: string, lease: string, watermark: number) => {
      const subscription = _subscriptions[consumer] || { watermark: -1 };
      // update watermark while lease is still valid
      if (
        subscription.lease &&
        subscription.lease === lease &&
        subscription.expires &&
        subscription.expires > new Date()
      ) {
        subscription.watermark = watermark;
        delete subscription.lease;
        delete subscription.expires;
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }
  };
};
