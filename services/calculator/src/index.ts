import { App, config } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { CalculatorCommandsFactory } from "./Aggregates/Calculator.Commands";
import { Calculator } from "./Aggregates/Calculator";
import { CalculatorEventsFactory } from "./Aggregates/Calculator.Events";
import { Counter } from "./Policies/Counter";

const app = App(new ExpressApp(PostgresStore(), PubSubBroker()));

app.withAggregate(Calculator, CalculatorCommandsFactory);
app.withPolicy(Counter, CalculatorEventsFactory);

export const express = app.build();

if (express && !config.host.endsWith("cloudfunctions.net/calculator"))
  express.listen(config.port, () => {
    app.log.info("Express app is listening", config);
  });
