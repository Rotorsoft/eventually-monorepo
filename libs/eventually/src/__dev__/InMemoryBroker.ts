import axios, { AxiosResponse } from "axios";
import { App } from "../App";
import { Broker } from "../Broker";
import {
  Aggregate,
  CommandHandler,
  CommittedEvent,
  EventHandler,
  Message,
  Policy
} from "../core";

interface Subscription {
  [event: string]: { factory: () => EventHandler<any, any>; path: string }[];
}
const subscriptions: Subscription = {};

export const InMemoryBroker = (host: string): Broker => ({
  subscribe: (
    event: CommittedEvent<string, any>,
    factory: () => { name: () => string } & EventHandler<any, any>,
    path: string
  ): Promise<void> => {
    const subscription = (subscriptions[event.name] =
      subscriptions[event.name] || []);
    subscription.push({ factory, path });
    return Promise.resolve();
  },

  emit: async (event: CommittedEvent<string, any>): Promise<void> => {
    const subscription = subscriptions[event.name];
    if (subscription) {
      const promises = subscription.map(async ({ factory, path }) => {
        if (host) return axios.post<void>(host.concat(path), event);
        else {
          await App().handleEvent(factory() as Policy<any, any>, event);
        }
      });
      await Promise.all(promises);
    }
  },

  body: (body: any): any => body,

  send: async (
    command: Message<string, any>,
    factory: (id: string) => CommandHandler<any, any, any>,
    path: string,
    id: string,
    expectedVersion?: string
  ): Promise<AxiosResponse | [any, CommittedEvent<string, any>]> => {
    if (host) {
      const headers = expectedVersion
        ? { ["If-Match"]: expectedVersion }
        : undefined;
      return await axios.post<void>(
        host.concat(path.replace(":id", id)),
        command,
        {
          headers
        }
      );
    } else {
      return await App().handleCommand(
        factory(id) as Aggregate<any, any, any>,
        command
      );
    }
  }
});
