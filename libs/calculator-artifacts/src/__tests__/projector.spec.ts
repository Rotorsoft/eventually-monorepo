import { app, client, dispose } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { CalculatorTotals } from "../calculator.projector";
import { pressKey, reset } from "./messages";

// app setup
const chance = new Chance();
app().with(Calculator).with(CalculatorTotals).build();

describe("Projector", () => {
  beforeAll(async () => {
    await app().listen();
  });
  afterAll(async () => {
    await dispose()();
  });

  it("should count keys", async () => {
    const id = chance.guid();
    await reset(id);
    await pressKey(id, "1");
    await pressKey(id, "1");
    await pressKey(id, "2");
    await pressKey(id, ".");
    await pressKey(id, "3");

    const pid = "Totals-Calculator-".concat(id);
    const response = await client().read(CalculatorTotals, [pid]);
    expect(response[pid]?.state).toEqual({
      id: pid,
      totals: {
        "1": 2,
        "2": 1,
        "3": 1,
        ".": 1
      }
    });
    expect(response[pid]?.watermark).toBe(7);
  });
});
