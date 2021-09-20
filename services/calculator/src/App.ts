import { App } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { CalculatorCommandsFactory } from "./Aggregates/Calculator.Commands";
import { Calculator } from "./Aggregates/Calculator";

const app = App(PostgresStore());
app.use(Calculator, CalculatorCommandsFactory);
app.listen();
