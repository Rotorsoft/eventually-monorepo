import { PubSub, Topic as GcpTopic } from "@google-cloud/pubsub";
import {
  Broker,
  CommittedEvent,
  log,
  Payload,
  Topic
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

const pubsub = new PubSub(
  config.gcp.project ? { projectId: config.gcp.project } : {}
);
const topics: { [name: string]: GcpTopic } = {};

const getTopic = async (name: string): Promise<GcpTopic> => {
  let topic = topics[name];
  if (!topic) {
    topic = new GcpTopic(pubsub, name);
    const [exists] = await topic.exists();
    if (!exists) await topic.create();
    topics[name] = topic;
  }
  return topic;
};

export const PubSubBroker = (): Broker => {
  return {
    subscribe: async (
      name: string,
      url: string,
      topic: Topic
    ): Promise<void> => {
      const sub = (await getTopic(topic.name)).subscription(name);
      const [exists] = await sub.exists();
      if (!exists)
        await sub.create({
          pushEndpoint: url,
          enableMessageOrdering: !!topic.orderingKey
        });
      else if (sub.metadata?.pushConfig?.pushEndpoint !== url)
        await sub.modifyPushConfig({ pushEndpoint: url });
    },

    publish: async (
      event: CommittedEvent<string, Payload>,
      topic: Topic
    ): Promise<string> => {
      let t: GcpTopic;
      try {
        t = await getTopic(event.name);
        const [messageId] = await t.publishMessage({
          data: Buffer.from(JSON.stringify(event)),
          orderingKey: topic.orderingKey
        });
        return `${messageId}@${event.name}`;
      } catch (error) {
        log().error(error);
        t && t.resumePublishing(topic.orderingKey);
        return error.message;
      }
    },

    decode: (msg: Payload): CommittedEvent<string, Payload> => {
      const { message, subscription } = msg as unknown as Message;
      if (message && subscription)
        return JSON.parse(
          Buffer.from(message.data, "base64").toString("utf-8")
        ) as CommittedEvent<string, Payload>;
      return msg as CommittedEvent<string, Payload>;
    }
  };
};
