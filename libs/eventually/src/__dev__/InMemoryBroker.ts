import {
  app,
  Broker,
  CommittedEvent,
  EventHandlerFactory,
  Evt,
  Payload,
  PolicyFactory
} from "..";
import { Subscriptions } from "../builder";

export const InMemoryBroker = (): Broker => {
  const _subscriptions: Subscriptions = {};

  return {
    subscribe: (factory: EventHandlerFactory, name: string): Promise<void> => {
      const sub = (_subscriptions[name] = _subscriptions[name] || []);
      sub.push(factory);
      return Promise.resolve();
    },

    publish: <C, E>(
      event: CommittedEvent<keyof E & string, Payload>
    ): Promise<string> => {
      const sub = _subscriptions[event.name];
      if (sub) {
        sub.map((f: PolicyFactory<C, E>) =>
          setTimeout(() => app().event(f, event), 10)
        );
        return Promise.resolve(event.name);
      }
    },

    decode: (msg: Payload): Evt => msg as Evt
  };
};
