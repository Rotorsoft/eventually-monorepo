import { AppBase } from "./AppBase";
import { config, Environments } from "./config";
import { ExpressApp } from "./routers/ExpressApp";
import { Store } from "./Store";
import { InMemoryApp, InMemoryStore } from "./__dev__";

export * from "./core";
export * from "./config";
export * from "./Store";
export * from "./Test";

let app: AppBase | undefined;

export const App = (store: Store = InMemoryStore()): AppBase => {
  if (!app)
    app =
      config.env === Environments.test
        ? new InMemoryApp(InMemoryStore())
        : new ExpressApp(store);
  return app;
};
