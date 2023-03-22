import {
  app,
  broker,
  client,
  dispose,
  ProjectionRecord
} from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { CalculatorTotals, Totals } from "../calculator.projector";
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
    await broker().drain();

    const pid = "Totals-".concat(id);
    let record: ProjectionRecord<Totals> | undefined;
    await client().read(CalculatorTotals, pid, (r) => (record = r));
    expect(record?.state).toEqual({
      id: pid,
      "1": 2,
      "2": 1,
      "3": 1
    });
    expect(record?.watermark).toBe(7);
  });
});
