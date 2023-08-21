import {
  Calculator,
  CalculatorTotals,
  PressKeyAdapter
} from "@rotorsoft/calculator-artifacts";
import { app, bootstrap } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
//import { PostgresSnapshotStore, PostgresStore } from "@rotorsoft/eventually-pg";

void bootstrap(async (): Promise<void> => {
  // store(PostgresStore("calculator"));
  const _app = app(new ExpressApp())
    .with(Calculator, { scope: "public" })
    .with(PressKeyAdapter)
    .with(CalculatorTotals);
  _app.build();
  await _app.listen();
});
