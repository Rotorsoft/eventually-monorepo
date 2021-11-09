import { PubSub, Topic as GcpTopic } from "@google-cloud/pubsub";
import {
  Broker,
  eventHandlerPath,
  CommittedEvent,
  log,
  Payload,
  EventHandlerFactory
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
const orderingKey = "id";
const topics: { [name: string]: GcpTopic } = {};

const topic = async (name: string): Promise<GcpTopic> => {
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
      handler: EventHandlerFactory<Payload, unknown, unknown>,
      name: string
    ): Promise<void> => {
      const url = `${config.host}${eventHandlerPath(handler, name)}`;
      const sub = (await topic(name)).subscription(
        handler.name.concat(".", name)
      );
      const [exists] = await sub.exists();
      if (!exists)
        await sub.create({
          pushEndpoint: url,
          enableMessageOrdering: true
        });
      else if (sub.metadata?.pushConfig?.pushEndpoint !== url)
        await sub.modifyPushConfig({ pushEndpoint: url });
    },

    publish: async (
      event: CommittedEvent<string, Payload>
    ): Promise<string> => {
      let t: GcpTopic;
      try {
        t = await topic(event.name);
        const [messageId] = await t.publishMessage({
          data: Buffer.from(JSON.stringify(event)),
          orderingKey
        });
        return `${messageId}@${event.name}`;
      } catch (error) {
        log().error(error);
        t && t.resumePublishing(orderingKey);
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
