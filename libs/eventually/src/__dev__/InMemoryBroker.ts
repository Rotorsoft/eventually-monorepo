import {
  app,
  Broker,
  Evt,
  Payload,
  PolicyFactory,
  ProcessManagerFactory
} from "..";
import { Subscriptions } from "../builder";

export const InMemoryBroker = (): Broker => {
  const _subscriptions: Subscriptions = {};

  return {
    subscribe: (
      factory:
        | PolicyFactory<unknown, unknown>
        | ProcessManagerFactory<Payload, unknown, unknown>,
      event: Evt
    ): Promise<void> => {
      const sub = (_subscriptions[event.name] =
        _subscriptions[event.name] || []);
      sub.push(factory);
      return Promise.resolve();
    },

    publish: (event: Evt): Promise<string> => {
      const sub = _subscriptions[event.name];
      if (sub) {
        sub.map((f) => setTimeout(() => app().event(f, event), 10));
        return Promise.resolve(event.name);
      }
    },

    decode: (msg: Payload): Evt => msg as Evt
  };
};
