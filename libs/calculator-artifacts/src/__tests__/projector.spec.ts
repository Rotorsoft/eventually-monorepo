import { app, client, dispose, ProjectionRecord } from "@rotorsoft/eventually";
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

    const pid = "Totals-Calculator-".concat(id);
    let record: ProjectionRecord<Totals> = {
      state: { id: "", totals: {} },
      watermark: -1
    };
    await client().read(CalculatorTotals, pid, (r) => (record = r));
    expect(record.state).toEqual({
      id: pid,
      totals: {
        "1": 2,
        "2": 1,
        "3": 1,
        ".": 1
      }
    });
    expect(record.watermark).toBe(7);
  });
});
