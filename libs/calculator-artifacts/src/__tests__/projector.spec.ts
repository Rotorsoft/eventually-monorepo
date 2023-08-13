import { app, broker, client, dispose, seed } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { CalculatorTotals } from "../calculator.projector";
import { pressKey, reset } from "./messages";

// app setup
const chance = new Chance();
app().with(Calculator).with(CalculatorTotals).build();

describe("Projector", () => {
  beforeAll(async () => {
    await seed();
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
    await broker().drain();

    const pid = "Totals-".concat(id);
    const record = await client().read(CalculatorTotals, pid);
    expect(record.at(0)?.state).toEqual({
      id: pid,
      "1": 2,
      "2": 1,
      "3": 1
    });
    expect(record.at(0)?.watermark).toBe(7);
  });
});
