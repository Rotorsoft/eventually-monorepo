import { PubSub, Topic as GcpTopic } from "@google-cloud/pubsub";
import {
  Broker,
  policyEventPath,
  Evt,
  EvtOf,
  Payload,
  PolicyFactory,
  TopicNotFound
} from "@rotorsoft/eventually";
import { config } from "./config";

type Message = {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
};

export const PubSubBroker = (): Broker => {
  const topics: { [name: string]: GcpTopic } = {};

  return {
    topic: async <E>(event: EvtOf<E>): Promise<void> => {
      const options = config.gcp.project
        ? { projectId: config.gcp.project }
        : {};

      const pubsub = new PubSub(options);
      const topic = new GcpTopic(pubsub, event.name);
      const [exists] = await topic.exists();
      if (!exists) await topic.create();
      topics[event.name] = topic;
    },

    subscribe: async <C, E, M extends Payload>(
      factory: PolicyFactory<C, E, M>,
      event: EvtOf<E>
    ): Promise<void> => {
      const topic = topics[event.name];
      if (!topic) throw new TopicNotFound(event);

      const url = `${config.host}${policyEventPath(factory, event)}`;
      const sub = topic.subscription(factory.name.concat(".", event.name));
      const [exists] = await sub.exists();
      if (!exists)
        await sub.create({
          pushEndpoint: url,
          enableMessageOrdering: true
        });
      else if (sub.metadata?.pushConfig?.pushEndpoint !== url)
        await sub.modifyPushConfig({ pushEndpoint: url });
    },

    publish: async <E>(event: EvtOf<E>): Promise<string> => {
      const topic = topics[event.name];
      if (!topic) throw new TopicNotFound(event);

      const orderingKey = "id";
      try {
        const [messageId] = await topic.publishMessage({
          data: Buffer.from(JSON.stringify(event)),
          orderingKey
        });
        return `${messageId}@${event.id}`;
      } catch (error) {
        topic.resumePublishing(orderingKey);
      }
    },

    decode: (msg: Payload): Evt => {
      const { message, subscription } = msg as unknown as Message;
      if (message && subscription)
        return JSON.parse(
          Buffer.from(message.data, "base64").toString("utf-8")
        ) as Evt;
      return msg as Evt;
    }
  };
};
