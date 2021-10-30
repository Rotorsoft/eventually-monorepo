import { AppBase } from "./app";
import { singleton } from "./singleton";
import { InMemoryApp } from "./__dev__";

export * from "./app";
export * from "./config";
export * from "./interfaces";
export * from "./log";
export * from "./types";
export * from "./utils";
export * from "./builder";

export const app = singleton(function app(app?: AppBase) {
  return app || new InMemoryApp();
});
