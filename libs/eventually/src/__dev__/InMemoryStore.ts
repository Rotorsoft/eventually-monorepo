import { EvtOf, Evt, MsgOf } from "../types";
import { Store } from "../Store";

export const InMemoryStore = (): Store => {
  const stream: Evt[] = [];

  return {
    load: async <E>(
      id: string,
      reducer: (event: EvtOf<E>) => void
      // eslint-disable-next-line
    ): Promise<void> => {
      const events = stream.filter((e) => e.aggregateId === id);
      events.map(reducer);
    },

    commit: async <E>(
      id: string,
      events: MsgOf<E>[],
      expectedVersion?: string
      // eslint-disable-next-line
    ): Promise<EvtOf<E>[]> => {
      const aggregate = stream.filter((e) => e.aggregateId === id);
      if (
        expectedVersion &&
        (aggregate.length - 1).toString() !== expectedVersion
      )
        throw Error("Concurrency Error");

      let version = aggregate.length;
      return events.map((event) => {
        const committed: EvtOf<E> = {
          ...event,
          eventId: stream.length,
          aggregateId: id,
          aggregateVersion: version.toString(),
          createdAt: new Date()
        };
        stream.push(committed);
        version++;
        return committed;
      });
    },

    read: async (name?: string, after = -1, limit = 1): Promise<Evt[]> => {
      const events: Evt[] = [];
      let i = after + 1;
      while (events.length < limit && i < stream.length) {
        const e = stream[i++];
        if (!name || name === e.name) events.push(e);
      }
      return Promise.resolve(events);
    }
  };
};
