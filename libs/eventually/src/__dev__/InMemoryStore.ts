import { Broker, Store } from "../interfaces";
import { EvtOf, MsgOf } from "../types";

export const InMemoryStore = (): Store => {
  const _events: any[] = [];

  return {
    init: (): Promise<void> => {
      return;
    },

    close: (): Promise<void> => {
      return;
    },

    read: <E>(
      callback: (event: EvtOf<E>) => void,
      options?: {
        stream?: string;
        name?: string;
        after?: number;
        limit?: number;
      }
    ): Promise<void> => {
      const { stream, name, after = -1, limit } = options;
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

    commit: async <E>(
      stream: string,
      events: MsgOf<E>[],
      expectedVersion?: string,
      broker?: Broker
      // eslint-disable-next-line
    ): Promise<EvtOf<E>[]> => {
      const aggregate = _events.filter((e) => e.stream === stream);
      if (
        expectedVersion &&
        (aggregate.length - 1).toString() !== expectedVersion
      )
        throw Error("Concurrency Error");

      let version = aggregate.length;
      const committed = events.map((event) => {
        const committed: EvtOf<E> = {
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

      // publish inside transaction to ensure "at-least-once" delivery
      if (broker) await Promise.all(committed.map((e) => broker.publish(e)));

      return committed;
    }
  };
};
