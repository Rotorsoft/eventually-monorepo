import axios, { AxiosResponse } from "axios";
import { App } from "../index";
import { Broker } from "../Broker";
import {
  Aggregate,
  CommandHandler,
  CommittedEvent,
  EventHandler,
  Message
} from "../core";

// routePolicy<Commands, Events>(
//   policy: () => Policy<Commands, Events>,
//   factory: MessageFactory<Events>
// ): Promise<void> {
//   const instance = policy();
//   handlersOf(factory).map(async (f) => {
//     const event = f();
//     if (Object.keys(instance).includes("on".concat(event.name))) {
//       const path = "/".concat(
//         decamelize(instance.name()),
//         "/",
//         decamelize(event.name)
//       );
//       await this.subscribe(event, policy, path);
//     }
//   });
//   return Promise.resolve();
// }

// routeProjector<Events>(
//   projector: () => Projector<Events>,
//   factory: MessageFactory<Events>
// ): Promise<void> {
//   const instance = projector();
//   handlersOf(factory).map(async (f) => {
//     const event = f();
//     if (Object.keys(instance).includes("on".concat(event.name))) {
//       const path = "/".concat(
//         decamelize(instance.name()),
//         "/",
//         decamelize(event.name)
//       );
//       await this.subscribe(event, projector, path);
//     }
//   });
//   return Promise.resolve();
//   }

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
          console.log(`TODO handle event - ${factory.name} -> ${event.name}`);
          // await App().handleEvent(factory() as Policy<any, any>, event);
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
      return await App().handle(
        factory(id) as Aggregate<any, any, any>,
        command
      );
    }
  }
});
