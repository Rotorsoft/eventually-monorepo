import {
  AppBase,
  Broker,
  Evt,
  EvtOf,
  Payload,
  PolicyFactory,
  TopicNotFound
} from "..";

export const InMemoryBroker = (app: AppBase): Broker => {
  const _topics: {
    [name: string]: PolicyFactory<unknown, unknown, Payload>[];
  } = {};

  return {
    topic: <E>(event: EvtOf<E>): Promise<void> => {
      _topics[event.name] = _topics[event.name] || [];
      return Promise.resolve();
    },

    subscribe: <C, E, M extends Payload>(
      factory: PolicyFactory<C, E, M>,
      event: EvtOf<E>
    ): Promise<void> => {
      const topic = _topics[event.name];
      if (!topic) throw new TopicNotFound(event);

      topic.push(factory);
      return Promise.resolve();
    },

    publish: async <E>(event: EvtOf<E>): Promise<string> => {
      const topic = _topics[event.name];
      if (!topic) throw new TopicNotFound(event);

      const promises = topic.map((factory) =>
        app.event(factory as PolicyFactory<unknown, E, Payload>, event)
      );
      await Promise.all(promises);

      return event.id.toString();
    },

    decode: (msg: Payload): Evt => msg as Evt
  };
};
