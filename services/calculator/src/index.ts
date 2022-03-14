import { app, config, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import { Calculator } from "./calculator.aggregate";
import { Commands } from "./calculator.commands";
import { Events } from "./calculator.events";
import { Counter, StatelessCounter } from "./counter.policy";
import * as schemas from "./calculator.schemas";

store(PostgresStore("calculator"));

const expressApp = app(new ExpressApp());
expressApp
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withAggregate(Calculator, `Aggregates **calculator** instances`)
  .withProcessManager(
    Counter,
    `Counts keys and *resets* calculator when the
  number of consecutire key presses without resoulution exceeds some **limit**`
  )
  .withEventHandlers(StatelessCounter);

// make express available to gcloud functions as entry point to app
export const express = expressApp.build();

// process.on("SIGTERM", () => {
//   app().log.info("red", "SIGTERM signal received: closing HTTP server");
//   void app().close();
// });

void expressApp.listen(config().host.endsWith("cloudfunctions.net/calculator"));
