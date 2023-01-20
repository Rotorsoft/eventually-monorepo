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
  const snapshotStore = PostgresSnapshotStore("calculators");
  await snapshotStore.seed();

  store(PostgresStore("calculator"));
  await store().seed();

  const _app = app(new ExpressApp())
    .withSnapshot(Calculator, {
      store: snapshotStore,
      threshold: 0,
      expose: true
    })
    .with(Calculator)
    .with(Counter)
    .with(StatelessCounter)
    .with(PressKeyAdapter)
    .with(CalculatorTotals);

  _app.build();
  await _app.listen();
});
