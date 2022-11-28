import { AppBase } from "./app";
import { singleton } from "./singleton";
import { InMemoryApp } from "./__dev__";

export * from "./app";
export * from "./config";
export * from "./interfaces";
export * from "./log";
export * from "./singleton";
export * from "./types";
export * from "./utils";

export const app = singleton(function app<T extends AppBase = InMemoryApp>(
  app?: T
): T {
  return app || (new InMemoryApp() as T);
});
