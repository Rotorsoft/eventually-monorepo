import { app, broker, client, dispose } from "@rotorsoft/eventually";
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
    await pressKey(id, "2");
    await pressKey(id, "3");
    await pressKey(id, "4");
    await pressKey(id, "5");
    await broker().drain();

    const { event, state } = await client().load(Calculator, id);

    expect(event?.name).toBe("Cleared");
    expect(state).toEqual(expect.objectContaining({ result: 0 }));

    const { applyCount } = await client().load(
      Counter,
      event?.stream || "",
      false
    );
    expect(applyCount).toBeGreaterThan(5);
  });

  it("should Reset on DotPressed", async () => {
    const id = chance.guid();
    await reset(id);
    await pressKey(id, "1");
    await pressKey(id, "1");
    await pressKey(id, "2");
    await pressKey(id, "2");
    await pressKey(id, ".");
    await broker().drain();

    const { state } = await client().load(Calculator, id);
    expect(state).toEqual(expect.objectContaining({ result: 0 }));
    expect(state.left).toBeUndefined();
  });
});
