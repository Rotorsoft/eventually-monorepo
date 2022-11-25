import { AppBase } from "./app";
import { singleton } from "./singleton";
import { InMemoryApp } from "./__dev__";

export * from "./app";
export * from "./config";
export * from "./interfaces";
export * from "./log";
export * from "./singleton";
export * from "./types/artifacts";
export * from "./types/enums";
export * from "./types/errors";
export * from "./types/factories";
export * from "./types/messages";
export * from "./utils";

export const app = singleton(function app<T extends AppBase = InMemoryApp>(
  app?: T
): T {
  return app || (new InMemoryApp() as T);
});
