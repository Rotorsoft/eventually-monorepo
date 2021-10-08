import { PubSub, Topic as GcpTopic } from "@google-cloud/pubsub";
import {
  Broker,
  EvtOf,
  log,
  Payload,
  policyEventPath,
  PolicyFactory
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

const topic = async (event: EvtOf<unknown>): Promise<GcpTopic> => {
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
      factory: PolicyFactory<unknown, unknown, Payload>,
      event: EvtOf<unknown>
    ): Promise<void> => {
      const url = `${config.host}${policyEventPath(factory, event)}`;
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
    },

    publish: async (event: EvtOf<unknown>): Promise<string> => {
      let t: GcpTopic;
      try {
        t = await topic(event);
        const [messageId] = await t.publishMessage({
          data: Buffer.from(JSON.stringify(event)),
          orderingKey
        });
        return `${messageId}@${event.id}`;
      } catch (error) {
        log().error(error);
        if (t) t.resumePublishing(orderingKey);
      }
    },

    decode: (msg: Payload): EvtOf<unknown> => {
      const { message, subscription } = msg as unknown as Message;
      if (message && subscription)
        return JSON.parse(
          Buffer.from(message.data, "base64").toString("utf-8")
        ) as EvtOf<unknown>;
      return msg as EvtOf<unknown>;
    }
  };
};
