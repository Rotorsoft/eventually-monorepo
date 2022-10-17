import { app, bootstrap, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Calculator } from "./calculator.aggregate";
import { Counter, StatelessCounter } from "./counter.policy";
import { PostgresSnapshotStore, PostgresStore } from "libs/eventually-pg/dist";
import { Keys } from "./calculator.models";
import joi from "joi";
import { Commands } from "./calculator.commands";

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
    .withEventHandlers(StatelessCounter)
    .withCommandAdapter<{ id: string; key: Keys }, Commands>(
      "PressKeyAdapter",
      ({ id, key }) => ({
        id,
        name: "PressKey",
        data: { key }
      }),
      joi
        .object<{ id: string; key: Keys }>({
          id: joi.string(),
          key: joi.string()
        })
        .options({ presence: "required" })
    );

  _app.build();
  await _app.listen();
});
