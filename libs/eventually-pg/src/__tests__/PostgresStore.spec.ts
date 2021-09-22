import { Chance } from "chance";
import { Message, Payload } from "@rotorsoft/eventually";
import { PostgresStore } from "../PostgresStore";

const db = PostgresStore();

const chance = new Chance();
const a1 = chance.guid();
const a2 = chance.guid();
const a3 = chance.guid();
const e1 = chance.guid();
const e2 = chance.guid();

const event = (name: string, data?: Payload): Message<string, Payload> => ({
  name,
  schema: () => null,
  data
});

describe("PostgresStore", () => {
  it("should commit events", async () => {
    await db.commit(a1, event(e1, { value: "1" }));
    await db.commit(a1, event(e1, { value: "2" }));
    await db.commit(a2, event(e2, { value: "3" }));
    await db.commit(a3, event(e1, { value: "4" }));
    await db.commit(a1, event(e2, { value: "5" }));

    let first: number,
      count = 0;
    await db.load(a1, (e) => {
      first = first || e.eventId;
      count++;
    });
    expect(first).toBeGreaterThan(0);
    expect(count).toBe(3);
  });

  it("should throw concurrency error", async () => {
    const committed = await db.commit(a1, event(e2, { value: "1" }));
    await expect(
      db.commit(a1, event(e2), committed.aggregateVersion + "1")
    ).rejects.toThrowError("Concurrency Error");
  });

  it("should read stream", async () => {
    const events = await db.read();
    expect(events.length).toBe(1);
  });

  it("should read stream with after", async () => {
    const events = await db.read(undefined, 2, 2);
    expect(events[0].eventId).toBe(3);
    expect(events.length).toBe(2);
  });

  it("should read stream by name", async () => {
    const events = await db.read(e1, undefined, 5);
    expect(events[0].name).toBe(e1);
    expect(events.length).toBe(3);
  });

  it("should read stream with limit", async () => {
    const events = await db.read(undefined, undefined, 5);
    expect(events.length).toBe(5);
  });
});
