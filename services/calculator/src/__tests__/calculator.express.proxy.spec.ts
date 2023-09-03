import { Calculator, CalculatorTotals } from "@rotorsoft/calculator-artifacts";
import { app, broker, dispose, HttpProxy, store } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Chance } from "chance";

const chance = new Chance();
const port = 4020;
const proxy = HttpProxy(`http://localhost:${port}`);

const expressApp = new ExpressApp();
app(expressApp)
  .with(Calculator, { scope: "public" })
  .with(CalculatorTotals)
  .build();

describe("calculator express app with proxy", () => {
  beforeAll(async () => {
    await expressApp.listen(port);
  });

  beforeEach(async () => {
    await store().reset();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should compute correctly", async () => {
    const id = chance.guid();

    await proxy.command(Calculator, id, "PressKey", { key: "1" });
    await proxy.command(Calculator, id, "PressKey", { key: "+" });
    await proxy.command(Calculator, id, "PressKey", { key: "2" });
    await proxy.command(Calculator, id, "PressKey", { key: "." });
    await proxy.command(Calculator, id, "PressKey", { key: "3" });
    await proxy.command(Calculator, id, "PressKey", { key: "=" });
    await broker().drain();

    const response = await proxy.load(Calculator, id);
    console.log("???????????????????", response);
    expect(response?.result?.state).toEqual({
      left: "3.3",
      result: 3.3
    });

    const res2 = await proxy.query(CalculatorTotals, {
      where: { id: `Totals-${id}` }
    });
    expect(res2.result).toEqual([
      {
        state: {
          id: `Totals-${id}`,
          t1: 1,
          t2: 1,
          t3: 1
        },
        watermark: 4
      }
    ]);
  });
});
