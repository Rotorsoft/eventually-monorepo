import axios, { AxiosResponse } from "axios";
import {
  Broker,
  CommandHandler,
  CommittedEvent,
  EventHandler,
  Message
} from "@rotorsoft/eventually";
import { config } from "./config";
import { Topic } from "./Topic";

export const PubSubBroker = (): Broker => {
  return {
    subscribe: async (
      event: CommittedEvent<string, any>,
      factory: () => { name: () => string } & EventHandler<any, any>,
      path: string
    ): Promise<void> => {
      const name = factory().name();
      const topic = await Topic(event.name);
      const sub = topic.subscription(`${name}-${event.name}`);
      const route = `${config.host}${path}`;
      const [exists] = await sub.exists();
      try {
        if (!exists) {
          await sub.create({ pushEndpoint: route });
        } else if (sub.metadata?.pushConfig?.pushEndpoint !== route) {
          await sub.modifyPushConfig({ pushEndpoint: route });
        }
      } catch (error) {
        console.error(
          `Error subscribing ${name} to ${event.name}:`,
          error.message
        );
      }
    },

    emit: async (event: CommittedEvent<string, any>): Promise<void> => {
      const topic = await Topic(event.name);
      await topic.publish(Buffer.from(JSON.stringify(event)));
    },

    body: (body: any): any => {
      if (body.subscription && body.message) {
        const buffer = Buffer.from(body.message.data, "base64");
        return JSON.parse(buffer.toString("utf-8"));
      }
      return body;
    },

    send: async (
      command: Message<string, any>,
      factory: (id: string) => CommandHandler<any, any, any>,
      path: string,
      id: string,
      expectedVersion?: string
    ): Promise<AxiosResponse | [any, CommittedEvent<string, any>]> => {
      const headers = expectedVersion
        ? { ["If-Match"]: expectedVersion }
        : undefined;
      return await axios.post<void>(
        config.host.concat(path.replace(":id", id)),
        command,
        {
          headers
        }
      );
    }
  };
};
