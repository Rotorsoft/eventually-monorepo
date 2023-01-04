import { Builder } from "./builder";
import { config as _config } from "./config";
import { Disposable, Logger, ProjectorStore, Store } from "./interfaces";
import * as loggers from "./loggers";
import { singleton } from "./singleton";
import { Client, Environments } from "./types";
import {
  InMemoryApp,
  InMemoryClient,
  InMemoryProjectorStore,
  InMemoryStore
} from "./__dev__";

export const config = singleton(function config() {
  return { ..._config(), name: "config", dispose: () => Promise.resolve() };
});

export const app = singleton(function app<T extends Builder = InMemoryApp>(
  app?: T
): T {
  return app || (new InMemoryApp() as T);
});

export const store = singleton(function store(store?: Store) {
  return store || InMemoryStore();
});

export const projector = singleton(function projector(
  projector?: ProjectorStore
) {
  return projector || InMemoryProjectorStore();
});

export const log = singleton(function log(logger?: Logger) {
  if (logger) return logger;
  switch (config().env) {
    case Environments.development:
      return loggers.devLogger();
    default:
      return loggers.plainLogger();
  }
});

export const client = singleton(function client(client?: Client & Disposable) {
  return client || InMemoryClient();
});
