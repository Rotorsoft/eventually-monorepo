import { app, broker, config, snapshotStores, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { PostgresSnapshotStore, PostgresStore } from "@rotorsoft/eventually-pg";
import { Calculator } from "./calculator.aggregate";
import { commands } from "./calculator.commands";
import { events } from "./calculator.events";
import { Counter } from "./counter.policy";

store(PostgresStore("calculator"));
broker(config().host !== "http://localhost" ? PubSubBroker() : undefined);
snapshotStores({
  postgres: PostgresSnapshotStore("calculator_snapshots")
})

const expressApp = app(new ExpressApp()) as ExpressApp;
expressApp
  .withEvents(events)
  .withCommands(commands)
  .withCommandHandlers(Calculator)
  .withEventHandlers(Counter);

// make express available to gcloud functions as entry point to app
export const express = expressApp.build();

void expressApp.listen(config().host.endsWith("cloudfunctions.net/calculator"));
