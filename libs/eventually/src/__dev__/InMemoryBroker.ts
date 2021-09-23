import { App } from "..";
import { Broker } from "../Broker";
import { CommittedEvent, Payload, Policy } from "../types";
import { eventPath } from "../utils";

export const InMemoryBroker = (): Broker => {
  const _topics: {
    [name: string]: Policy<unknown, unknown>[];
  } = {};

  return {
    subscribe: <Commands, Events>(
      policy: Policy<Commands, Events>,
      event: CommittedEvent<keyof Events & string, Payload>
    ): Promise<void> => {
      (_topics[event.name] = _topics[event.name] || []).push(policy);
      App().log.trace("red", `[POST ${event.name}]`, eventPath(policy, event));
      return Promise.resolve();
    },

    emit: async <Events>(
      event: CommittedEvent<keyof Events & string, Payload>
    ): Promise<void> => {
      const topic = _topics[event.name];
      if (topic) {
        const promises = topic.map((policy) =>
          App().event<any, any>(policy, event)
        );
        await Promise.all(promises);
      }
    },

    decode: (msg: Payload): CommittedEvent<string, Payload> =>
      msg as CommittedEvent<string, Payload>
  };
};
