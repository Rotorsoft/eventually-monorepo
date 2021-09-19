import { Broker } from "./Broker";
import { config, Environments } from "./config";
import { AppBase } from "./engine";
import { Express } from "./routers/Express";
import { Store } from "./Store";
import { InMemoryApp } from "./__dev__/InMemoryApp";
import { InMemoryBroker } from "./__dev__/InMemoryBroker";
import { InMemoryStore } from "./__dev__/InMemoryStore";

let app: AppBase | undefined;

export const App = (options?: { broker?: Broker; store?: Store }): AppBase => {
  if (!app) {
    if (config.env === Environments.test)
      app = new InMemoryApp(InMemoryBroker(""), InMemoryStore());
    else
      app = new Express(
        options?.broker || InMemoryBroker(""),
        options?.store || InMemoryStore()
      );
  }
  return app;
};
