import { app, dispose } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { HttpClient } from "@rotorsoft/eventually-openapi";
import { Chance } from "chance";
import {
  CalculatorTotals,
  TotalsEvents
} from "@rotorsoft/calculator-artifacts";
import { createEvent } from "./messages";

const chance = new Chance();
const port = 4005;
const http = HttpClient(port);
const _app = app(new ExpressApp()).with(CalculatorTotals, {
  scope: "public"
});

describe("calculator with projector in express app", () => {
  beforeAll(async () => {
    _app.build();
    await _app.listen(port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should project", async () => {
    const stream = "Calculator-".concat(chance.guid());
    await http.project(CalculatorTotals, [
      createEvent<TotalsEvents>("DigitPressed", stream, { digit: "1" }, 1)
    ]);
    const results = await http.project(CalculatorTotals, [
      createEvent<TotalsEvents>("DigitPressed", stream, { digit: "1" }, 2)
    ]);
    expect(results).toEqual({
      upserted: 1,
      deleted: 0,
      watermark: 2
    });

    const response = await http.read(CalculatorTotals, `Totals-${stream}`);
    expect(response?.at(0)?.state["1"]).toEqual(2);
    expect(response?.at(0)?.watermark).toEqual(2);
  });

  it("should query", async () => {
    const stream1 = "Calculator-".concat(chance.guid());
    const stream2 = "Calculator-".concat(chance.guid());
    await http.project(CalculatorTotals, [
      createEvent<TotalsEvents>("DigitPressed", stream1, { digit: "1" }, 1),
      createEvent<TotalsEvents>("DigitPressed", stream1, { digit: "2" }, 2),
      createEvent<TotalsEvents>("DigitPressed", stream2, { digit: "3" }, 3),
      createEvent<TotalsEvents>("DigitPressed", stream2, { digit: "3" }, 4),
      createEvent<TotalsEvents>("DigitPressed", stream2, { digit: "3" }, 5)
    ]);

    const records = await http.read(CalculatorTotals, `Totals-${stream2}`);
    expect(records.at(0)?.state["3"]).toBe(3);

    const records1 = await http.read(CalculatorTotals, {
      select: ["id"],
      where: {
        id: { eq: `Totals-${stream2}` },
        ["3"]: { gt: 1 }
      },
      sort: { id: "asc" },
      limit: 10
    });
    expect(records1.length).toEqual(1);
  });
});
