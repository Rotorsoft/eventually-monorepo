import {
  Calculator,
  CalculatorTotals,
  Counter,
  PressKeyAdapter,
  StatelessCounter
} from "@rotorsoft/calculator-artifacts";
import { app, bootstrap, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresSnapshotStore, PostgresStore } from "@rotorsoft/eventually-pg";

void bootstrap(async (): Promise<void> => {
  const snapshotStore = PostgresSnapshotStore("calculators", 0);
  await snapshotStore.seed();

  store(PostgresStore("calculator"));
  await store().seed();

  const _app = app(new ExpressApp())
    .with(Calculator, { store: snapshotStore })
    .with(Counter)
    .with(StatelessCounter)
    .with(PressKeyAdapter)
    .with(CalculatorTotals);

  _app.build();
  await _app.listen();
});
