import {
  InMemoryApp,
  InMemoryAsyncBroker,
  InMemoryClient,
  InMemoryProjectorStore,
  InMemoryStore,
  InMemorySyncBroker
} from "./adapters";
import { Builder } from "./builder";
import { config as _config } from "./config";
import { Disposable, Logger, Store } from "./interfaces";
import * as loggers from "./loggers";
import { singleton } from "./singleton";
import { Client, Environments } from "./types";

/**
 * @category Ports
 * @remarks Global port to configuration
 */
export const config = singleton(function config() {
  return { ..._config(), name: "config", dispose: () => Promise.resolve() };
});

/**
 * @category Ports
 * @remarks Global port to application builder
 * @example Bootstrapping a service
 ```ts
 void bootstrap(async (): Promise<void> => {
  // Seed the stores (this should be done by CI/CD pipelines)
  await store().seed();
  await pgHotelProjectorStore.seed();
  await pgNext30ProjectorStore.seed();

  // Register artifacts, build the app
  const express = app(new ExpressApp())
    .with(Room)
    .with(Hotel, { store: pgHotelProjectorStore })
    .with(Next30Days, { store: pgNext30ProjectorStore })
    .build();

  // Start listing to incoming messages  
  await app().listen();
});
 ``` 
 */
export const app = singleton(function app<T extends Builder = InMemoryApp>(
  app?: T
): T {
  return app || (new InMemoryApp() as T);
});

/**
 * @category Ports
 * @remarks Global port to event store
 * @example Bootstrapping a service with a Postgres store adapter
 ```ts
 void bootstrap(async (): Promise<void> => {
  store(PostgresStore("hotel"));

  // Register artifacts, build the app
  const express = app(new ExpressApp())
    .with(Room)
    .build();

  // Start listing to incoming messages  
  await app().listen();
});
 ``` 
 */
export const store = singleton(function store(store?: Store) {
  return store || InMemoryStore();
});

/**
 * @category Ports
 * @remarks Global port to logging
 */
export const log = singleton(function log(logger?: Logger) {
  if (logger) return logger;
  switch (config().env) {
    // case Environments.test: //-- to log when testing
    case Environments.development:
      return loggers.devLogger();
    default:
      return loggers.plainLogger();
  }
});

/**
 * @category Ports
 * @remarks Global port to client api
 * @example Calling a command via the client port
 ```ts
 await client().command(Room, "OpenRoom", room, {
    id: id || room.number.toString()
 });
 ```
 */
export const client = singleton(function client(client?: Client & Disposable) {
  return client || InMemoryClient();
});

/**
 * @category Ports
 * @remarks Global port to internal broker
 */
export const broker = singleton(function broker() {
  switch (config().env) {
    case Environments.test:
      return InMemorySyncBroker();
    default:
      return InMemoryAsyncBroker();
  }
});

/**
 * @category Ports
 * @remarks Global port to in-memory projection store
 * - this is used only in dev/testing mode
 */
export const _imps = singleton(function imps() {
  return InMemoryProjectorStore();
});
