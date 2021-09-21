import { App } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { CalculatorCommandsFactory } from "./Aggregates/Calculator.Commands";
import { Calculator } from "./Aggregates/Calculator";
import { CalculatorEventsFactory } from "./Aggregates/Calculator.Events";
import { Counter } from "./Policies/Counter";

const app = App(PostgresStore());
app.withAggregate(Calculator, CalculatorCommandsFactory);
app.withPolicy(Counter, CalculatorEventsFactory);
app.listen();
