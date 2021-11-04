import { PubSub, Topic as GcpTopic } from "@google-cloud/pubsub";
import {
  Broker,
  eventHandlerPath,
  Evt,
  log,
  Msg,
  Payload,
  PolicyFactory,
  ProcessManagerFactory
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

const topic = async (event: Msg): Promise<GcpTopic> => {
  let topic = topics[event.name];
  if (!topic) {
    topic = new GcpTopic(pubsub, event.name);
    const [exists] = await topic.exists();
    if (!exists) await topic.create();
    topics[event.name] = topic;
  }
  return topic;
};

export const PubSubBroker = (): Broker => {
  return {
    subscribe: async (
      factory:
        | PolicyFactory<unknown, unknown>
        | ProcessManagerFactory<Payload, unknown, unknown>,
      event: Msg
    ): Promise<void> => {
      if (event.scope() === "public") {
        const url = `${config.host}${eventHandlerPath(factory, event)}`;
        const sub = (await topic(event)).subscription(
          factory.name.concat(".", event.name)
        );
        const [exists] = await sub.exists();
        if (!exists)
          await sub.create({
            pushEndpoint: url,
            enableMessageOrdering: true
          });
        else if (sub.metadata?.pushConfig?.pushEndpoint !== url)
          await sub.modifyPushConfig({ pushEndpoint: url });
      }
    },

    publish: async (event: Evt): Promise<string> => {
      let t: GcpTopic;
      try {
        t = await topic(event);
        const [messageId] = await t.publishMessage({
          data: Buffer.from(JSON.stringify(event)),
          orderingKey
        });
        return `${messageId}@${event.name}`;
      } catch (error) {
        log().error(error);
        if (t) t.resumePublishing(orderingKey);
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
