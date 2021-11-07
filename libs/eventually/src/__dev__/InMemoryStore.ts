import { Store } from "../interfaces";
import { AllQuery, CommittedEvent, Message, Payload } from "../types";

export const InMemoryStore = (): Store => {
  const _events: any[] = [];

  return {
    init: (): Promise<void> => {
      _events.length = 0;
      return;
    },

    close: (): Promise<void> => {
      _events.length = 0;
      return;
    },

    query: (
      callback: (event: CommittedEvent<string, Payload>) => void,
      query?: AllQuery
    ): Promise<void> => {
      const { stream, name, after = -1, limit } = query;
      let i = after + 1,
        count = 0;
      while (i < _events.length) {
        const e = _events[i++];
        if (stream && e.stream !== stream) continue;
        if (name && e.name !== name) continue;
        callback(e);
        if (limit && ++count >= limit) break;
      }
      return Promise.resolve();
    },

    commit: async (
      stream: string,
      events: Message<string, Payload>[],
      expectedVersion?: number,
      callback?: (events: CommittedEvent<string, Payload>[]) => Promise<void>
    ): Promise<CommittedEvent<string, Payload>[]> => {
      const aggregate = _events.filter((e) => e.stream === stream);
      if (expectedVersion && aggregate.length - 1 !== expectedVersion)
        throw Error("Concurrency Error");

      let version = aggregate.length;
      const committed = events.map(({ name, data }) => {
        const committed = {
          id: _events.length,
          stream,
          version,
          created: new Date(),
          name,
          data
        };
        _events.push(committed);
        version++;
        return committed;
      }) as CommittedEvent<string, Payload>[];

      if (callback) await callback(committed);

      return committed;
    }
  };
};
