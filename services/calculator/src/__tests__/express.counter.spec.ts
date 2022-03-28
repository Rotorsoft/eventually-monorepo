import { app, bind, dispose, Snapshot } from "@rotorsoft/eventually";
import { ExpressApp, tester } from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { Commands } from "../calculator.commands";
import { Events } from "../calculator.events";
import { Counter } from "../counter.policy";
import * as schemas from "../calculator.schemas";
import { CalculatorModel, Keys } from "../calculator.models";

const chance = new Chance();
const port = 4001;
const t = tester(port);

const _app = app(new ExpressApp())
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withCommandHandlers(Calculator)
  .withEventHandlers(Counter);

const pressKey = (
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel>[]> =>
  t.command(Calculator, bind("PressKey", { key }, id));

describe("express app", () => {
  beforeAll(() => {
    _app.build();
    _app.listen(false, port);
  });

  afterAll(() => {
    dispose()();
  });

  describe("Calculator", () => {
    it("should compute correctly", async () => {
      const id = chance.guid();

      await pressKey(id, "1");
      await pressKey(id, "+");
      await pressKey(id, "2");
      await pressKey(id, ".");
      await pressKey(id, "3");
      await pressKey(id, "=");

      const { state } = await t.load(Calculator, id);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      const calc_snapshots = await t.stream(Calculator, id);
      expect(calc_snapshots.length).toEqual(6);

      const count_snapshots = await t.stream(
        Counter,
        `Counter-Calculator-${id}`
      );
      expect(count_snapshots.length).toEqual(6);
    });
  });
});
