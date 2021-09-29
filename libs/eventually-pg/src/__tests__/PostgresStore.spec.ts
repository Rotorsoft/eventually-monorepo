import { Chance } from "chance";
import { MsgOf, Payload, Evt } from "@rotorsoft/eventually";
import { PostgresStore } from "../PostgresStore";

const db = PostgresStore();

const chance = new Chance();
const a1 = chance.guid();
const a2 = chance.guid();
const a3 = chance.guid();

type E = {
  test1: { value: string };
  test2: { value: string };
  test3: { value: string };
};

const event = (name: keyof E, data?: Payload): MsgOf<E> => ({
  name,
  schema: () => null,
  data
});

describe("PostgresStore", () => {
  beforeAll(async () => {
    await db.init();
  });

  it("should commit events", async () => {
    await db.commit(a1, [event("test1", { value: "1" })]);
    await db.commit(a1, [event("test1", { value: "2" })]);
    await db.commit(a2, [event("test2", { value: "3" })]);
    await db.commit(a3, [event("test1", { value: "4" })]);
    await db.commit(a1, [event("test2", { value: "5" })]);

    let first: number,
      count = 0;
    await db.load(a1, (e) => {
      first = first || e.eventId;
      count++;
    });
    expect(first).toBeGreaterThan(0);
    expect(count).toBe(3);
  });

  it("should commit events array", async () => {
    await db.commit(a1, [
      event("test3", { value: "1" }),
      event("test3", { value: "2" }),
      event("test3", { value: "3" })
    ]);

    const events: Evt[] = [];
    await db.load(a1, (e) => {
      events.push(e);
    });
    const l = events.length;
    expect(l).toBeGreaterThan(2);
    expect(events[l - 1].data).toStrictEqual({ value: "3" });
    expect(events[l - 2].data).toStrictEqual({ value: "2" });
    expect(events[l - 3].data).toStrictEqual({ value: "1" });
  });

  it("should throw concurrency error", async () => {
    const committed = await db.commit(a1, [event("test2", { value: "1" })]);
    await expect(
      db.commit(a1, [event("test2")], committed[0].aggregateVersion + "1")
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
    const events = await db.read("test1", undefined, 5);
    expect(events[0].name).toBe("test1");
    expect(events.length).toBeGreaterThanOrEqual(3);
    events.map((evt) => expect(evt.name).toBe("test1"));
  });

  it("should read stream with limit", async () => {
    const events = await db.read(undefined, undefined, 5);
    expect(events.length).toBe(5);
  });
});
