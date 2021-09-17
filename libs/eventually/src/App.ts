import { Config, Environments } from "./config";
import { Bus, Store } from "./core";
import { AppBase } from "./engine";
import { Express } from "./routers/Express";
import { InMemoryApp } from "./__dev__/InMemoryApp";
import { InMemoryBus } from "./__dev__/InMemoryBus";
import { InMemoryStore } from "./__dev__/InMemoryStore";

let app: AppBase | undefined;

export const App = (config?: Config, bus?: Bus, store?: Store): AppBase => {
  if (!app) {
    if (!config || config.env === Environments.test)
      app = new InMemoryApp(InMemoryBus(""), InMemoryStore());
    else app = new Express(bus || InMemoryBus(""), store || InMemoryStore());
  }
  return app;
};
