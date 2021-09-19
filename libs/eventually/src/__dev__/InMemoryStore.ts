import { CommittedEvent, Message, Payload } from "../core";
import { Store } from "../Store";

interface Data {
  [key: string]: CommittedEvent<string, Payload>[];
}

export const InMemoryStore = (): Store => {
  const data: Data = {};

  return {
    load: async (
      id: string,
      reducer: (event: CommittedEvent<string, Payload>) => void
      // eslint-disable-next-line
    ): Promise<void> => {
      const events = data[id] || [];
      events.map(reducer);
    },

    commit: async (
      id: string,
      event: Message<string, Payload>,
      expectedVersion?: string
      // eslint-disable-next-line
    ): Promise<CommittedEvent<string, Payload>> => {
      // Begin ACID transaction
      const stream = (data[id] = data[id] || []);

      if (expectedVersion && (stream.length - 1).toString() !== expectedVersion)
        throw Error("Concurrency Error");

      // TODO Policies can commit other correlation ids
      const committed: CommittedEvent<string, Payload> = {
        ...event,
        id,
        version: stream.length.toString(),
        timestamp: new Date()
      };

      stream.push(committed);
      // End ACID transaction

      return committed;
    }
  };
};
