process.env.PORT = "3006";

import { app, bind, Snapshot } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { command, load, sleep, stream } from "@rotorsoft/eventually-test";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { Commands } from "../calculator.commands";
import { Events } from "../calculator.events";
import { Counter } from "../counter.policy";
import * as schemas from "../calculator.schemas";
import { CalculatorModel, Keys } from "../calculator.models";

const chance = new Chance();
const port = +process.env.PORT;

app(new ExpressApp())
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withCommandHandlers(Calculator)
  .withEventHandlers(Counter)
  .build();

const pressKey = (
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel>[]> =>
  command(Calculator, bind("PressKey", { key }, id), port);

describe("express app", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await app().close();
  });

  describe("Calculator", () => {
    it("should compute correctly", async () => {
      const id = chance.guid();

      await pressKey(id, "1");
      await sleep(100);
      await pressKey(id, "+");
      await sleep(100);
      await pressKey(id, "2");
      await sleep(100);
      await pressKey(id, ".");
      await sleep(100);
      await pressKey(id, "3");
      await sleep(100);
      await pressKey(id, "=");
      await sleep(100);

      const { state } = await load(Calculator, id, port);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      const calc_snapshots = await stream(Calculator, id, { port });
      expect(calc_snapshots.length).toEqual(6);

      const count_snapshots = await stream(Counter, `CounterCalculator${id}`, {
        port
      });
      expect(count_snapshots.length).toEqual(6);
    });
  });
});
