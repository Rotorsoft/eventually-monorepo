import {
  InMemoryApp,
  InMemoryBroker,
  InMemoryClient,
  InMemoryProjectorStore,
  InMemoryStore,
  InMemorySubscriptionStore
} from "./adapters";
import { Builder } from "./builder";
import { config as _config } from "./config";
import {
  Broker,
  Disposable,
  Logger,
  Store,
  SubscriptionStore
} from "./interfaces";
import * as loggers from "./loggers";
import { port } from "./port";
import { Client } from "./types";

/**
 * @category Ports
 * @remarks Global port to configuration
 */
export const config = port(function config() {
  return { ..._config(), name: "config", dispose: () => Promise.resolve() };
});

/**
 * @category Ports
 * @remarks Global port to application builder
 * @example Bootstrapping a service
 ```ts
 void bootstrap(async (): Promise<void> => {
  // Seed the stores (this should be done by CI/CD pipelines)
  // Register artifacts, build the app
  const express = app(new ExpressApp())
    .with(Room)
    .with(Hotel, {
      projector: {
        store: PostgresProjectorStore("hotel"),
        indexes: [{ type: "asc" }]
      }
    })
    .with(Next30Days, {
      projector: { store: PostgresProjectorStore("next30"), indexes: [{}] }
    })
    .build();

  // To seed the stores (CI/CD)
  await seed(); 

  // Start listing to incoming messages  
  await app().listen();
});
 ``` 
 */
export const app = port(function app<T extends Builder = InMemoryApp>(
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
export const store = port(function store(store?: Store) {
  return store || InMemoryStore();
});

/**
 * @category Ports
 * @remarks Global port to subscriptions store
 */
export const subscriptions = port(function subscriptions(
  store?: SubscriptionStore
) {
  return store || InMemorySubscriptionStore();
});

/**
 * @category Ports
 * @remarks Global port to logging
 */
export const log = port(function log(logger?: Logger) {
  if (logger) return logger;
  switch (config().env) {
    // case "test": //-- to log when testing
    case "development":
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
export const client = port(function client(client?: Client & Disposable) {
  return client || InMemoryClient();
});

/**
 * @category Ports
 * @remarks Global port to internal broker
 */
export const broker = port(function broker(broker?: Broker) {
  return broker || InMemoryBroker();
});

/**
 * @category Ports
 * @remarks Global port to in-memory projection store
 * - this is used only in dev/testing mode
 */
export const _imps = port(function imps() {
  return InMemoryProjectorStore();
});
