import { Store, CommittedEvent, Message } from "../core";

interface Data {
  [key: string]: CommittedEvent<string, any>[];
}

export const InMemoryStore = (): Store => {
  const data: Data = {};

  return {
    load: async (
      id: string,
      reducer: (event: CommittedEvent<string, any>) => void
      // eslint-disable-next-line
    ): Promise<void> => {
      const events = data[id] || [];
      events.map(reducer);
    },

    commit: async (
      id: string,
      event: Message<string, any>,
      expectedVersion?: string
      // eslint-disable-next-line
    ): Promise<CommittedEvent<string, any>> => {
      // Begin ACID transaction
      const stream = (data[id] = data[id] || []);

      if (expectedVersion && (stream.length - 1).toString() !== expectedVersion)
        throw Error("Concurrency Error");

      // TODO Policies can commit other correlation ids
      const committed = {
        ...event,
        id,
        version: stream.length.toString()
      };

      stream.push(committed);
      // End ACID transaction

      return committed;
    }
  };
};
