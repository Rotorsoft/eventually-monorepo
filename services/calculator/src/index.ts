import { App, config, InMemoryBroker } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { commands } from "./calculator.commands";
import { Calculator } from "./calculator.aggregate";
import { events } from "./calculator.events";
import { Counter } from "./counter.policy";

const app = App(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withAggregate(Calculator)
  .withPolicy(Counter);

// export express to gcloud functions
export const express = app.build({
  store: PostgresStore("calculator"),
  broker: config().host === "localhost" ? InMemoryBroker(app) : PubSubBroker()
});

void app.listen(config().host.endsWith("cloudfunctions.net/calculator"));
