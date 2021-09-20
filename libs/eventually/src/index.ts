import { AppBase } from "./AppBase";
import { config, Environments } from "./config";
import { ExpressApp } from "./routers/ExpressApp";
import { Store } from "./Store";
import { InMemoryApp, InMemoryStore } from "./__dev__";

export * from "./core";
export * from "./config";
export * from "./Store";
export * from "./Broker";
export * from "./Test";

let app: AppBase | undefined;

export const App = (store?: Store): AppBase => {
  if (!app) {
    if (config.env === Environments.test)
      app = new InMemoryApp(InMemoryStore());
    else app = new ExpressApp(store || InMemoryStore());
  }
  return app;
};
