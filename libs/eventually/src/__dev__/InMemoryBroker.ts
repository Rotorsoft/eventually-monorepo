import { AppBase, Evt, EvtOf, Payload, PolicyFactory, TopicNotFound } from "..";
import { Broker } from "../Broker";

export const InMemoryBroker = (app: AppBase): Broker => {
  const _topics: {
    [name: string]: PolicyFactory<unknown, unknown>[];
  } = {};

  return {
    topic: <E>(event: EvtOf<E>): Promise<void> => {
      _topics[event.name] = _topics[event.name] || [];
      return Promise.resolve();
    },

    subscribe: <C, E>(
      factory: PolicyFactory<C, E>,
      event: EvtOf<E>
    ): Promise<void> => {
      const topic = _topics[event.name];
      if (!topic) throw new TopicNotFound(event);

      topic.push(factory);
      return Promise.resolve();
    },

    emit: async <E>(event: EvtOf<E>): Promise<void> => {
      const topic = _topics[event.name];
      if (!topic) throw new TopicNotFound(event);

      const promises = topic.map((factory) => app.event(factory, event));
      await Promise.all(promises);
    },

    decode: (msg: Payload): Evt => msg as Evt
  };
};
