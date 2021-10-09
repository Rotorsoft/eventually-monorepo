import { app, config, InMemoryBroker } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { commands } from "./calculator.commands";
import { Calculator } from "./calculator.aggregate";
import { events } from "./calculator.events";
import { Counter } from "./counter.policy";

const expressApp = app(new ExpressApp()) as ExpressApp;
expressApp
  .withEvents(events)
  .withCommands(commands)
  .withAggregates(Calculator)
  .withPolicies(Counter)
  .build({
    store: PostgresStore("calculator"),
    broker:
      config().host === "localhost" ? InMemoryBroker(app()) : PubSubBroker()
  });
void expressApp.listen(config().host.endsWith("cloudfunctions.net/calculator"));
