import { CommittedEvent, Message, Payload } from "../types";
import { Store } from "../Store";

export const InMemoryStore = (): Store => {
  const stream: CommittedEvent<string, Payload>[] = [];

  type Subscription = { event: string; cursor: number };
  const subscriptions: Subscription[] = [];

  return {
    load: async <Events>(
      id: string,
      reducer: (event: CommittedEvent<keyof Events & string, Payload>) => void
      // eslint-disable-next-line
    ): Promise<void> => {
      const events = stream.filter((e) => e.aggregateId === id);
      events.map(reducer);
    },

    commit: async <Events>(
      id: string,
      event: Message<keyof Events & string, Payload>,
      expectedVersion?: string
      // eslint-disable-next-line
    ): Promise<CommittedEvent<keyof Events & string, Payload>> => {
      const events = stream.filter((e) => e.aggregateId === id);

      if (expectedVersion && (events.length - 1).toString() !== expectedVersion)
        throw Error("Concurrency Error");

      const committed: CommittedEvent<keyof Events & string, Payload> = {
        ...event,
        eventId: stream.length,
        aggregateId: id,
        aggregateVersion: events.length.toString(),
        createdAt: new Date()
      };

      stream.push(committed);

      return committed;
    },

    subscribe: async (event: string, from?: number): Promise<string> => {
      subscriptions.push({ event, cursor: from || -1 });
      return Promise.resolve((subscriptions.length - 1).toString());
    },

    poll: async (
      subscription: string,
      limit?: number
    ): Promise<CommittedEvent<string, Payload>[]> => {
      const sub = subscriptions[Number.parseInt(subscription)];
      if (sub) {
        const events: CommittedEvent<string, Payload>[] = [];
        while (events.length < limit) {
          for (let i = sub.cursor; i < stream.length; i++) {
            const e = stream[Number(i)];
            if (e.name === sub.event) {
              events.push();
            }
          }
        }
        return Promise.resolve(events);
      }
      return Promise.resolve([]);
    },

    ack: (subscription: string, id: number): Promise<boolean> => {
      const sub = subscriptions[Number.parseInt(subscription)];
      if (sub && id > sub.cursor) {
        sub.cursor = id;
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }
  };
};
