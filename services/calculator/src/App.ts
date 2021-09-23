import { App } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { PubSubBroker } from "@rotorsoft/eventually-gcp";
import { CalculatorCommandsFactory } from "./Aggregates/Calculator.Commands";
import { Calculator } from "./Aggregates/Calculator";
import { CalculatorEventsFactory } from "./Aggregates/Calculator.Events";
import { Counter } from "./Policies/Counter";

//const app = App();
const app = App(PostgresStore(), PubSubBroker());
app.withAggregate(Calculator, CalculatorCommandsFactory);
app.withPolicy(Counter, CalculatorEventsFactory);
app.listen();
