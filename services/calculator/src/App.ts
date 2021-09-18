import { App } from "@rotorsoft/eventually";
import { config } from "@rotorsoft/eventually-pg";
import { CalculatorCommandsFactory } from "./Aggregates/Calculator.Commands";
import { Calculator } from "./Aggregates/Calculator";
import { Counter } from "./Policies/Counter";
import { CalculatorEventsFactory } from "./Aggregates/Calculator.Events";
import { CalculatorProjector } from "./Projectors/Calculator.Projector";

console.log(config);

const app = App();

const routes = async (): Promise<void> => {
  await app.routeAggregate(Calculator, CalculatorCommandsFactory);
  await app.routePolicy(Counter, CalculatorEventsFactory);
  await app.routeProjector(CalculatorProjector, CalculatorEventsFactory);
};

void routes().then(() => app.listen());
