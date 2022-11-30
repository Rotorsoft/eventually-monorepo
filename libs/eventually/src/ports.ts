import { Builder } from "./builder";
import { config as configFactory } from "./config";
import { Logger, Store } from "./interfaces";
import * as loggers from "./loggers";
import { singleton } from "./singleton";
import { Environments } from "./types";
import { InMemoryApp, InMemoryStore } from "./__dev__";

export const config = singleton(configFactory);

export const app = singleton(function app<T extends Builder = InMemoryApp>(
  app?: T
): T {
  return app || (new InMemoryApp() as T);
});

export const store = singleton(function store(store?: Store) {
  return store || InMemoryStore();
});

export const log = singleton(function log(logger?: Logger) {
  if (logger) return logger;
  switch (config().env) {
    case Environments.test:
      return loggers.testLogger();
    case Environments.development:
      return loggers.devLogger();
    default:
      return loggers.plainLogger();
  }
});
