import { app, bootstrap, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Calculator } from "./calculator.aggregate";
import { Counter, StatelessCounter } from "./counter.policy";
import { PostgresSnapshotStore, PostgresStore } from "libs/eventually-pg/dist";

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
    .withEventHandlers(StatelessCounter);

  _app.build();
  await _app.listen();
});
