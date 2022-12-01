import { app, dispose, Snapshot } from "@rotorsoft/eventually";
import { ExpressApp, HttpClient } from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import {
  Calculator,
  CalculatorEvents,
  Counter,
  CalculatorModel,
  Keys
} from "@rotorsoft/calculator-artifacts";

const chance = new Chance();
const port = 4001;
const http = HttpClient(port);

const _app = app(new ExpressApp()).with(Calculator).with(Counter);

const pressKey = (
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command(Calculator, "PressKey", { key }, { id });

describe("express app", () => {
  beforeAll(async () => {
    _app.build();
    await _app.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
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

      const { state } = await http.load(Calculator, id);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      const calc_snapshots = await http.stream(Calculator, id);
      expect(calc_snapshots.length).toEqual(6);

      const count_snapshots = await http.stream(
        Counter,
        `Counter-Calculator-${id}`
      );
      expect(count_snapshots.length).toEqual(6);
    });
  });
});
