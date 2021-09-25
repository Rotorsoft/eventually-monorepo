import { App, MsgOf } from "..";
import { Broker } from "../Broker";
import { EvtOf, Evt, Payload, Policy } from "../types";
import { eventPath } from "../utils";

export const InMemoryBroker = (): Broker => {
  const _topics: {
    [name: string]: Policy<unknown, unknown>[];
  } = {};

  return {
    subscribe: <C, E>(policy: Policy<C, E>, event: MsgOf<E>): Promise<void> => {
      (_topics[event.name] = _topics[event.name] || []).push(policy);
      App().log.trace("red", `[POST ${event.name}]`, eventPath(policy, event));
      return Promise.resolve();
    },

    emit: async <E>(event: EvtOf<E>): Promise<void> => {
      const topic = _topics[event.name];
      if (topic) {
        const promises = topic.map((policy) =>
          App().event<any, any>(policy, event)
        );
        await Promise.all(promises);
      }
    },

    decode: (msg: Payload): Evt => msg as Evt
  };
};
