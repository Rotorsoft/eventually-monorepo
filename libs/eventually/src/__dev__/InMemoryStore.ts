import { EvtOf, Evt, MsgOf } from "../types";
import { Store } from "../Store";

export const InMemoryStore = (): Store => {
  const _events: Evt[] = [];

  return {
    load: async <E>(
      stream: string,
      reducer: (event: EvtOf<E>) => void
      // eslint-disable-next-line
    ): Promise<void> => {

    getLastEvent: (stream:string) => {
      const events = _events.filter((e) => e.stream === stream);
      return Promise.resolve(events[events.length -1]);
    },

    commit: async <E>(
      stream: string,
      events: MsgOf<E>[],
      expectedVersion?: string
      // eslint-disable-next-line
    ): Promise<EvtOf<E>[]> => {
      const aggregate = _events.filter((e) => e.stream === stream);
      if (
        expectedVersion &&
        (aggregate.length - 1).toString() !== expectedVersion
      )
        throw Error("Concurrency Error");

      let version = aggregate.length;
      return events.map((event) => {
        const committed: EvtOf<E> = {
          ...event,
          id: _events.length,
          stream,
          version: version.toString(),
          created: new Date()
        };
        _events.push(committed);
        version++;
        return committed;
      });
    },

    read: async (name?: string, after = -1, limit = 1): Promise<Evt[]> => {
      const events: Evt[] = [];
      let i = after + 1;
      while (events.length < limit && i < _events.length) {
        const e = _events[i++];
        if (!name || name === e.name) events.push(e);
      }
      return Promise.resolve(events);
    },

    init: (): Promise<void> => {
      return;
    },

    close: (): Promise<void> => {
      return;
    }
  };
};
