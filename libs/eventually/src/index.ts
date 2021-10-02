import { AppBase } from "./AppBase";
import { InMemoryApp } from "./__dev__";

export * from "./AppBase";
export * from "./Broker";
export * from "./config";
export * from "./Store";
export * from "./types";
export * from "./utils";
export * from "./log";
export * from "./__dev__";

let app: AppBase | undefined;
export const App = (base?: AppBase): AppBase => {
  if (!app) app = base || new InMemoryApp();
  return app;
};
