import { AppBase, Broker, EvtOf, Payload, PolicyFactory } from "..";

export const InMemoryBroker = (app: AppBase): Broker => {
  const _topics: {
    [name: string]: PolicyFactory<unknown, unknown, Payload>[];
  } = {};

  return {
    subscribe: (
      factory: PolicyFactory<unknown, unknown, Payload>,
      event: EvtOf<unknown>
    ): Promise<void> => {
      const topic = (_topics[event.name] = _topics[event.name] || []);
      topic.push(factory);
      return Promise.resolve();
    },

    publish: (event: EvtOf<unknown>): Promise<string> => {
      const topic = _topics[event.name];
      if (topic) {
        // simulate async subscriptions with delay
        topic.map((f) => setTimeout(() => app.event(f, event), 5));
      }
      return Promise.resolve(event.id.toString());
    },

    decode: (msg: Payload): EvtOf<unknown> => msg as EvtOf<unknown>
  };
};
