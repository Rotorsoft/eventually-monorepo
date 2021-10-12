import { Store } from "../interfaces";
import { AllQuery, Evt, Msg } from "../types";

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

    read: (callback: (event: Evt) => void, query?: AllQuery): Promise<void> => {
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
      events: Msg[],
      expectedVersion?: number,
      callback?: (events: Evt[]) => Promise<void>
    ): Promise<Evt[]> => {
      const aggregate = _events.filter((e) => e.stream === stream);
      if (expectedVersion && aggregate.length - 1 !== expectedVersion)
        throw Error("Concurrency Error");

      let version = aggregate.length;
      const committed = events.map((event) => {
        const committed: Evt = {
          ...event,
          id: _events.length,
          stream,
          version,
          created: new Date()
        };
        _events.push(committed);
        version++;
        return committed;
      });

      if (callback) await callback(committed);

      return committed;
    }
  };
};
