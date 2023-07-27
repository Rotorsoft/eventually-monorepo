import { app, dispose, ProjectionRecord } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { HttpClient } from "@rotorsoft/eventually-openapi";
import { Chance } from "chance";
import {
  CalculatorTotals,
  Totals,
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
    await _app.listen(false, port);
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

    let response: ProjectionRecord<Totals> | undefined;
    await http.read(
      CalculatorTotals,
      `Totals-${stream}`,
      (r) => (response = r)
    );
    expect(response?.state["1"]).toEqual(2);
    expect(response?.watermark).toEqual(2);
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

    let rec: ProjectionRecord<Totals> | undefined;
    await http.read(CalculatorTotals, `Totals-${stream2}`, (r) => (rec = r));
    expect(rec?.state["3"]).toBe(3);

    const r1 = await http.read(
      CalculatorTotals,
      {
        select: ["id"],
        where: {
          id: { operator: "eq", value: `Totals-${stream2}` },
          ["3"]: { operator: "gt", value: 1 }
        },
        sort: { id: "asc" },
        limit: 10
      },
      (r) => r
    );
    expect(r1).toEqual(1);
  });
});
