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
    await pressKey(id, "2");
    await pressKey(id, "3");
    await pressKey(id, "4");
    await pressKey(id, "5");
    const { event, state } = await client().load(Calculator, id);

    // const e1: CommittedEvent[] = [];
    // const e2: CommittedEvent[] = [];
    // await client().load(
    //   Calculator,
    //   id,
    //   false,
    //   (e) => e.event && e1.push(e.event)
    // );
    // await client().load(
    //   Counter,
    //   event?.stream || "",
    //   false,
    //   (e) => e.event && e2.push(e.event)
    // );
    // log().events(e1);
    // log().events(e2);

    expect(event?.name).toBe("Cleared");
    expect(state).toEqual(expect.objectContaining({ result: 0 }));

    const { applyCount } = await client().load(
      Counter,
      event?.stream || "",
      false
    );
    expect(applyCount).toBe(5);
  });

  it("should Reset on DotPressed", async () => {
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
