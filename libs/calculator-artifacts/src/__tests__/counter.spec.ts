import { app, client, dispose } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { Counter } from "../counter.policy";
import { pressKey, reset } from "./messages";

// app setup
const chance = new Chance();
app().with(Calculator).with(Counter).build();

describe("Counter", () => {
  beforeAll(async () => {
    await app().listen();
  });
  afterAll(async () => {
    await dispose()();
  });

  it("should Reset on DigitPressed", async () => {
    const id = chance.guid();
    await reset(id);
    await pressKey(id, "1");
    await pressKey(id, "1");
    await pressKey(id, "2");
    await pressKey(id, ".");
    await pressKey(id, "3");

    const { event, state } = await client().load(Calculator, id);
    expect(event?.name).toBe("Cleared");
    expect(state).toEqual(expect.objectContaining({ result: 0 }));

    let cnt = 0;
    await client().load(
      Counter,
      "Counter-".concat(event?.stream || ""),
      false,
      () => {
        cnt++;
      }
    );
    expect(cnt).toBe(5);
  });

  it("should return Reset on DotPressed", async () => {
    const id = chance.guid();
    await reset(id);
    await pressKey(id, "1");
    await pressKey(id, "1");
    await pressKey(id, "2");
    await pressKey(id, "2");
    await pressKey(id, ".");

    const { state } = await client().load(Calculator, id);
    expect(state).toEqual(expect.objectContaining({ result: 0 }));
  });
});
