import { EvtOf, Evt, MsgOf } from "../types";
import { Store } from "../Store";

export const InMemoryStore = (): Store => {
  const stream: Evt[] = [];

  return {
    load: async <Events>(
      id: string,
      reducer: (event: EvtOf<Events>) => void
      // eslint-disable-next-line
    ): Promise<void> => {
      const events = stream.filter((e) => e.aggregateId === id);
      events.map(reducer);
    },

    commit: async <Events>(
      id: string,
      event: MsgOf<Events>,
      expectedVersion?: string
      // eslint-disable-next-line
    ): Promise<EvtOf<Events>> => {
      const events = stream.filter((e) => e.aggregateId === id);

      if (expectedVersion && (events.length - 1).toString() !== expectedVersion)
        throw Error("Concurrency Error");

      const committed: EvtOf<Events> = {
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
