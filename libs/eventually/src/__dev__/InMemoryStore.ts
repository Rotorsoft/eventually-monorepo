import { app } from "..";
import { Store, StoreStat } from "../interfaces";
import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  ConcurrencyError,
  Message
} from "../types";

export const InMemoryStore = (): Store => {
  const _events: CommittedEvent[] = [];

  /**
   * !!! IMPORTANT !!!
   * In memory store is used only for unit testing systems
   * The entire system is configured in memory and all event handlers are automatically subscribed to a single channel
   * Committed events are automatically published to all policies that are able to handle the events
   * A broker service should manage subscriptions when using a database as the store or in a distributed deployment
   * @param committed the committed events
   */
  const _notify = async (committed: CommittedEvent[]): Promise<void> => {
    for (const event of committed) {
      const msg = app().messages[event.name];
      await Promise.all(
        Object.values(msg.eventHandlerFactories).map((factory) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          app().event(factory, event as any)
        )
      );
    }
  };

  return {
    name: "InMemoryStore",
    dispose: () => {
      _events.length = 0;
      return Promise.resolve();
    },

    seed: () => undefined,

    query: (
      callback: (event: CommittedEvent) => void,
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
      } = query;
      let i = after + 1,
        count = 0;
      while (i < _events.length) {
        const e = _events[i++];
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
    },

    commit: async (
      stream: string,
      events: Message[],
      metadata: CommittedEventMetadata,
      expectedVersion?: number,
      notify?: boolean
    ): Promise<CommittedEvent[]> => {
      const aggregate = _events.filter((e) => e.stream === stream);
      if (expectedVersion && aggregate.length - 1 !== expectedVersion)
        throw new ConcurrencyError(
          aggregate.length - 1,
          events,
          expectedVersion
        );

      let version = aggregate.length;
      const committed = events.map(({ name, data }) => {
        const committed: CommittedEvent = {
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
      notify && (await _notify(committed));
      return committed;
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
    }
  };
};
