import { app, broker, dispose } from "@rotorsoft/eventually";
import { ExpressApp, HttpClient } from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import { Calculator, Counter } from "@rotorsoft/calculator-artifacts";
import { pressKey } from "./messages";

const chance = new Chance();
const port = 4001;
const http = HttpClient(port);
const _app = app(new ExpressApp()).with(Calculator).with(Counter);

describe("calculator with counter in express app", () => {
  beforeAll(async () => {
    _app.build();
    await _app.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should compute correctly", async () => {
    const id = chance.guid();

    await pressKey(http, id, "1");
    await pressKey(http, id, "+");
    await pressKey(http, id, "2");
    await pressKey(http, id, ".");
    await pressKey(http, id, "3");
    await pressKey(http, id, "=");
    await broker().drain();

    const { state } = await http.load(Calculator, id);
    expect(state).toEqual({
      left: "3.3",
      operator: "+",
      result: 3.3
    });

    const calc_snapshots = await http.stream(Calculator, id);
    expect(calc_snapshots.length).toEqual(6);

    const count_snapshots = await http.stream(Counter, `Calculator-${id}`);
    expect(count_snapshots.length).toEqual(6);
  });
});
