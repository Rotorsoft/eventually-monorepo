import { app, dispose } from "@rotorsoft/eventually";
import { ExpressApp, HttpClient } from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import {
  Calculator,
  CalculatorTotals,
  TotalsEvents
} from "@rotorsoft/calculator-artifacts";
import { createEvent } from "./messages";

const chance = new Chance();
const port = 4005;
const http = HttpClient(port);
const _app = app(new ExpressApp()).with(Calculator).with(CalculatorTotals);

describe("calculator with projector in express app", () => {
  beforeAll(async () => {
    _app.build();
    await _app.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should project", async () => {
    const stream = "Calculator-".concat(chance.guid());
    await http.project(
      CalculatorTotals,
      createEvent<TotalsEvents>("DigitPressed", stream, { digit: "1" }, 1)
    );
    const committed = await http.project(
      CalculatorTotals,
      createEvent<TotalsEvents>("DigitPressed", stream, { digit: "1" }, 2)
    );
    expect(committed).toEqual([
      {
        projection: {
          filter: { id: `Totals-${stream}` },
          values: { totals: { "1": 2 } }
        },
        records: 1,
        watermark: 2
      }
    ]);

    const response = await http.get(`/calculator-totals/Totals-${stream}`);
    expect(response.data).toEqual({
      state: { id: `Totals-${stream}`, totals: { "1": 2 } },
      watermark: 2
    });
  });
});
