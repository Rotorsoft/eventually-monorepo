import {
  CommittedEvent,
  Messages,
  app,
  client,
  dispose,
  seed
} from "@rotorsoft/eventually";
import { Chance } from "chance";
import {
  CalculatorTotals,
  TotalsEvents
} from "@rotorsoft/calculator-artifacts";
import { PostgresProjectorStore } from "../..";

const chance = new Chance();
const createEvent = <E extends Messages>(
  name: keyof E & string,
  stream: string,
  data: E[keyof E & string],
  id: number
): CommittedEvent<E> => ({
  id,
  stream,
  version: 0,
  created: new Date(),
  name,
  data,
  metadata: { correlation: "", causation: {} }
});

describe("calculator with pg projector", () => {
  const totalsStore = PostgresProjectorStore("calctotals");
  const _app = app().with(CalculatorTotals, {
    scope: "public",
    projector: { store: totalsStore, indexes: [] }
  });

  beforeAll(async () => {
    await totalsStore.drop();
    await seed();
    _app.build();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should project", async () => {
    const stream = "Calculator-".concat(chance.guid());
    await client().project(CalculatorTotals, [
      createEvent<TotalsEvents>("DigitPressed", stream, { digit: "1" }, 1)
    ]);
    const results = await client().project(CalculatorTotals, [
      createEvent<TotalsEvents>("DigitPressed", stream, { digit: "1" }, 2)
    ]);
    expect(results).toEqual({
      upserted: 1,
      deleted: 0,
      watermark: 2
    });

    const response = await client().read(CalculatorTotals, `Totals-${stream}`);
    expect(response?.at(0)?.state.t1).toEqual(2);
    expect(response?.at(0)?.watermark).toEqual(2);
  });

  it("should query", async () => {
    const stream1 = "Calculator-".concat(chance.guid());
    const stream2 = "Calculator-".concat(chance.guid());
    await client().project(CalculatorTotals, [
      createEvent<TotalsEvents>("DigitPressed", stream1, { digit: "1" }, 1),
      createEvent<TotalsEvents>("DigitPressed", stream1, { digit: "2" }, 2),
      createEvent<TotalsEvents>("DigitPressed", stream2, { digit: "3" }, 3),
      createEvent<TotalsEvents>("DigitPressed", stream2, { digit: "3" }, 4),
      createEvent<TotalsEvents>("DigitPressed", stream2, { digit: "3" }, 5)
    ]);

    const records = await client().read(CalculatorTotals, `Totals-${stream2}`);
    expect(records.at(0)?.state.t3).toBe(3);

    const records1 = await client().read(CalculatorTotals, {
      select: ["id"],
      where: {
        id: { eq: `Totals-${stream2}` },
        t3: { gt: 1 }
      },
      sort: { id: "asc" },
      limit: 10
    });
    expect(records1.length).toEqual(1);
  });
});
