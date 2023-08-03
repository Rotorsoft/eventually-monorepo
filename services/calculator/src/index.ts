import {
  Calculator,
  Counter,
  PressKeyAdapter,
  StatelessCounter
} from "@andela-technology/calculator-artifacts";
import { app, bootstrap, store } from "@andela-technology/eventually";
import { ExpressApp } from "@andela-technology/eventually-express";
import { PostgresSnapshotStore, PostgresStore } from "@andela-technology/eventually-pg";

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
