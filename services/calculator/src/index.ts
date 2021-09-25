import { App, config } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { commands } from "./calculator.commands";
import { Calculator } from "./calculator.aggregate";
import { events } from "./calculator.events";
import { Counter } from "./counter.policy";

const app = App(new ExpressApp(PostgresStore(), PubSubBroker()));

app.withAggregate(Calculator, commands);
app.withPolicy(Counter, events);

export const express = app.build();

if (express && !config.host.endsWith("cloudfunctions.net/calculator"))
  express.listen(config.port, () => {
    app.log.info("Express app is listening", config);
  });
