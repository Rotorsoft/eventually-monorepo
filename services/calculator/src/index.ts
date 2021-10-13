import { app, broker, config, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { commands } from "./calculator.commands";
import { Calculator } from "./calculator.aggregate";
import { events } from "./calculator.events";
import { Counter } from "./counter.policy";

store(PostgresStore("calculator"));
broker(config().host !== "localhost" ? PubSubBroker() : undefined);

const expressApp = app(new ExpressApp()) as ExpressApp;
expressApp
  .withEvents(events)
  .withCommands(commands)
  .withCommandHandlers(Calculator)
  .withEventHandlers(Counter);

// make express available to gcloud functions as entry point to app
export const express = expressApp.build();

void expressApp.listen(config().host.endsWith("cloudfunctions.net/calculator"));
