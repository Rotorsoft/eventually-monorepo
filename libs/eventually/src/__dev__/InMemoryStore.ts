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
      event: MsgOf<E>,
      expectedVersion?: string
      // eslint-disable-next-line
    ): Promise<EvtOf<E>> => {
      const events = stream.filter((e) => e.aggregateId === id);

      if (expectedVersion && (events.length - 1).toString() !== expectedVersion)
        throw Error("Concurrency Error");

      const committed: EvtOf<E> = {
        ...event,
        eventId: stream.length,
        aggregateId: id,
        aggregateVersion: events.length.toString(),
        createdAt: new Date()
      };

      stream.push(committed);

      return committed;
    },

    read: async (name?: string, after = -1, limit = 1): Promise<Evt[]> => {
      const events: Evt[] = [];
      while (events.length < limit) {
        for (let i = after + 1; i < stream.length; i++) {
          const e = stream[i];
          if (!name || name === e.name) events.push(e);
        }
      }
      return Promise.resolve(events);
    }
  };
};
