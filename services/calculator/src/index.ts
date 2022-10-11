import { app, bootstrap, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Calculator } from "./calculator.aggregate";
import { Commands } from "./calculator.commands";
import { Events } from "./calculator.events";
import { Counter, StatelessCounter } from "./counter.policy";
import * as schemas from "./calculator.schemas";
import { PostgresSnapshotStore, PostgresStore } from "libs/eventually-pg/dist";

void bootstrap(async (): Promise<void> => {
  const snapshotStore = PostgresSnapshotStore("calculators");
  await snapshotStore.seed();

  store(PostgresStore("calculator"));
  await store().seed();

  const _app = app(new ExpressApp())
    .withSchemas<Pick<Commands, "PressKey">>({
      PressKey: schemas.PressKey
    })
    .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
      DigitPressed: schemas.DigitPressed,
      OperatorPressed: schemas.OperatorPressed
    })
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
    .withSchemas<Pick<Events, "Cleared">>({
      Cleared: undefined
    })
    .withSchemas<Pick<Events, "Complex">>({
      Complex: schemas.Complex
    });

  _app.build();
  await _app.listen();
});
