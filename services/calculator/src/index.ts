import { app } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Calculator } from "./calculator.aggregate";
import { Commands } from "./calculator.commands";
import { Events } from "./calculator.events";
import { Counter, StatelessCounter } from "./counter.policy";
import * as schemas from "./calculator.schemas";

const _app = app(new ExpressApp())
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

_app.build();
_app.listen();
