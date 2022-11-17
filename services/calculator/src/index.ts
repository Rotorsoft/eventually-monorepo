import {
  Calculator,
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
    .withAggregate(Calculator, `Aggregates **calculator** instances`, {
      store: snapshotStore,
      threshold: 0,
      expose: true
    })
    .withProcessManager(
      Counter,
      `Counts keys and *resets* calculator when the
  number of consecutire key presses without resoulution exceeds some **limit**`
    )
    .withPolicy(StatelessCounter)
    .withCommandAdapter(PressKeyAdapter);

  _app.build();
  await _app.listen();
});
