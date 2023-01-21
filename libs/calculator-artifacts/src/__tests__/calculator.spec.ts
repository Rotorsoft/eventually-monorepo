import { Actor, app, client, dispose, store } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { Counter } from "../counter.policy";
import { Forget } from "../forget.system";
import { ExternalPayload, PressKeyAdapter } from "../presskey.adapter";
import { InMemorySnapshotStore } from "../../../eventually/src/adapters";
import { CalculatorCommands } from "../calculator.schemas";
import { createEvent, pressKey } from "./messages";

// app setup
const chance = new Chance();
const inMemorySnapshots = InMemorySnapshotStore(2);
app()
  .with(Forget)
  .with(Calculator)
  .with(Counter)
  .with(PressKeyAdapter)
  .withStore(Calculator, inMemorySnapshots)
  .build();

describe("Calculator", () => {
  beforeAll(async () => {
    // just to cover seeds
    await store().seed();
    await inMemorySnapshots.seed();
    jest.clearAllMocks();
    await app().listen();
  });
  afterAll(async () => {
    await dispose()();
  });

  beforeEach(async () => {
    // to clear in-memory store before each test
    await store().dispose();
  });

  it("should compute correctly", async () => {
    const id = chance.guid();
    await pressKey(id, "1");
    await pressKey(id, "+");
    await pressKey(id, "2");
    await pressKey(id, ".");
    await pressKey(id, "3");

    await client().invoke(PressKeyAdapter, {
      id,
      key: "="
    } as ExternalPayload);

    const { state } = await client().load(Calculator, id);
    expect(state).toEqual({
      left: "3.3",
      operator: "+",
      result: 3.3
    });

    // without snapshots
    const { applyCount: cnt1 } = await client().load(Calculator, id, false);
    expect(cnt1).toBe(6);

    // with snapshots
    const { applyCount: cnt2 } = await client().load(Calculator, id, true);
    expect(cnt2).toBe(2);
  });

  it("should compute correctly and read stream with and without snapshots", async () => {
    const id = chance.guid();
    await pressKey(id, "+");
    await pressKey(id, "1");
    await pressKey(id, "-");
    await pressKey(id, "2");
    await pressKey(id, "*");
    await pressKey(id, "3");
    await pressKey(id, "/");
    await pressKey(id, "3");
    await pressKey(id, "=");

    const { state } = await client().load(Calculator, id);
    expect(state).toEqual({
      left: "-1",
      operator: "/",
      result: -1
    });

    // stream without snapshots
    const { applyCount: c1 } = await client().load(Calculator, id, false);
    expect(c1).toBe(9);

    // stream with snapshots
    const { applyCount: c2 } = await client().load(Calculator, id, true);
    expect(c2).toBe(1);
  });

  it("should compute correctly 3", async () => {
    const id = chance.guid();
    await pressKey(id, ".");
    await pressKey(id, "1");
    await pressKey(id, "+");
    await pressKey(id, ".");
    await pressKey(id, "2");
    await pressKey(id, "=");

    const { state } = await client().load(Calculator, id);
    expect(state).toEqual({
      left: "0.3",
      operator: "+",
      result: 0.3
    });
  });

  it("should record metadata with actor", async () => {
    const id = chance.guid();
    const actor: Actor = { name: "the-actor", roles: [] };
    await client().command(
      Calculator,
      "PressKey",
      { key: "1" },
      { id, expectedVersion: -1, actor }
    );
    const { event } = await client().load(Calculator, id);
    expect(event?.metadata?.correlation.length).toEqual(24);
    expect(event?.metadata?.causation.command?.name).toEqual("PressKey");
  });

  it("should throw concurrency error", async () => {
    const id = chance.guid();
    await pressKey(id, "1");
    await expect(
      client().command(
        Calculator,
        "PressKey",
        { key: "1" },
        { id, expectedVersion: -1 }
      )
    ).rejects.toThrow();
  });

  it("should throw validation error", async () => {
    await expect(
      client().command(Calculator, "PressKey", {}, { id: chance.guid() })
    ).rejects.toThrow();
  });

  it("should throw model invariant violation", async () => {
    await expect(pressKey(chance.guid(), "=")).rejects.toThrowError(
      "Don't have an operator"
    );
  });

  it("should cover empty calculator", async () => {
    const id = chance.guid();
    const test8 = Calculator(id);
    await client().event(
      Counter,
      createEvent("DigitPressed", test8.stream(), { digit: "0" })
    );
    const { state } = await client().load(Calculator, id);
    expect(state).toEqual({ result: 0 });
  });

  it("should throw invalid command error", async () => {
    await expect(
      client().command(Calculator, "ForgetX" as keyof CalculatorCommands, {})
    ).rejects.toThrow();
  });
});
