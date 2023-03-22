import { app, client, dispose, sleep } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { Calculator, CalculatorModel } from "../calculator.aggregate";
import { InMemorySnapshotStore } from "../../../eventually/src/adapters";
import { pressKey } from "./messages";
import { CalculatorEvents } from "../calculator.schemas";

// app setup
const chance = new Chance();
const inMemorySnapshots = InMemorySnapshotStore<
  CalculatorModel,
  CalculatorEvents
>(2);
app().with(Calculator, { store: inMemorySnapshots }).build();

describe("All Stream", () => {
  const id = chance.guid();
  let created_after: Date, created_before: Date;

  beforeAll(async () => {
    await app().listen();
    await pressKey(id, "1");
    await pressKey(id, "+");

    await sleep(100);
    created_after = new Date();
    await sleep(100);

    await pressKey(id, "2");
    await pressKey(id, ".");

    await sleep(100);
    created_before = new Date();
    await sleep(100);

    await pressKey(id, "3");
    await pressKey(id, "=");
  });
  afterAll(async () => {
    await dispose()();
  });

  it("should read stream", async () => {
    const { count } = await client().query({ limit: 1 });
    expect(count).toBe(1);
  });

  it("should read stream by name", async () => {
    const { count } = await client().query(
      { names: ["DigitPressed"], limit: 3 },
      (e) => {
        expect(e.name).toBe("DigitPressed");
      }
    );
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("should read stream with after", async () => {
    const { first } = await client().query({ after: 3 });
    expect(first?.id).toBe(4);
  });

  it("should read stream with limit", async () => {
    const { count } = await client().query({ limit: 5 });
    expect(count).toBe(5);
  });

  it("should read stream with after and limit", async () => {
    const { first, count } = await client().query({ after: 2, limit: 2 });
    expect(first?.id).toBe(3);
    expect(count).toBe(2);
  });

  it("should read stream with stream name", async () => {
    const { count } = await client().query({
      stream: id,
      limit: 10
    });
    expect(count).toBe(6);
  });

  it("should return an empty stream", async () => {
    const { count } = await client().query({ names: [chance.guid()] });
    expect(count).toBe(0);
  });

  it("should read stream with before and after", async () => {
    const { last, count } = await client().query({
      after: 2,
      before: 4,
      limit: 5
    });
    expect(last?.id).toBe(3);
    expect(count).toBe(1);
  });

  it("should read stream with before and after created", async () => {
    const { first, count } = await client().query({
      stream: id,
      created_after,
      created_before,
      limit: 10
    });
    expect(first?.version).toBe(2);
    expect(count).toBe(2);
  });
});
