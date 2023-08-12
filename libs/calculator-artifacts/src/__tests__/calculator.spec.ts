import { Actor, app, client, dispose, store } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { Forget } from "../forget.system";
import { ExternalPayload, PressKeyAdapter } from "../presskey.adapter";
import { pressKey } from "./messages";

// app setup
const chance = new Chance();
app().with(Forget).with(Calculator).with(PressKeyAdapter).build();

describe("Calculator", () => {
  beforeAll(async () => {
    // just to cover seeds
    await store().seed();
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
      result: 3.3
    });

    const { applyCount: cnt1 } = await client().load(Calculator, id);
    expect(cnt1).toBe(6);
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
      result: -1
    });

    const { applyCount: c1 } = await client().load(Calculator, id);
    expect(c1).toBe(9);
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
      result: 0.3
    });
  });

  it("should record metadata with actor", async () => {
    const stream = chance.guid();
    const actor: Actor = { id: "the-actor", name: "the-actor" };
    await client().command(
      "PressKey",
      { key: "1" },
      { stream, expectedVersion: -1, actor }
    );
    const { event } = await client().load(Calculator, stream);
    expect(event?.metadata?.correlation.length).toEqual(36);
    expect(event?.metadata?.causation.command?.name).toEqual("PressKey");
  });

  it("should throw concurrency error", async () => {
    const stream = chance.guid();
    await pressKey(stream, "1");
    await expect(
      client().command(
        "PressKey",
        { key: "1" },
        { stream, expectedVersion: -1 }
      )
    ).rejects.toThrow();
  });

  it("should throw validation error", async () => {
    await expect(
      client().command("PressKey", {}, { stream: chance.guid() })
    ).rejects.toThrow();
  });

  it("should throw model invariant violation", async () => {
    await expect(pressKey(chance.guid(), "=")).rejects.toThrow(
      "Don't have an operator"
    );
  });

  it("should throw invalid command error", async () => {
    await expect(
      client().command("ForgetX", {}, { stream: "" })
    ).rejects.toThrow();
  });
});
