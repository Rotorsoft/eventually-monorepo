import { app, Broker, CommittedEvent, EventHandlerFactory, Payload } from "..";

export const InMemoryBroker = (): Broker => {
  return {
    subscribe: (): Promise<void> => {
      return Promise.resolve();
    },

    publish: <C, E>(
      event: CommittedEvent<keyof E & string, Payload>
    ): Promise<string> => {
      const msg = app().messages[event.name];
      msg.subscriptions.map((f: EventHandlerFactory<Payload, C, E>) =>
        setTimeout(() => app().event(f, event), 10)
      );
      return Promise.resolve(event.name);
    },

    decode: (msg: Payload): CommittedEvent<string, Payload> =>
      msg as CommittedEvent<string, Payload>
  };
};
