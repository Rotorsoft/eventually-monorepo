import { MsgOf, Payload, InMemoryStore } from "@rotorsoft/eventually";

const db = InMemoryStore();

const a1 = "a1";
const a2 = "a2";
const a3 = "a3";

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

describe("InMemoryStore", () => {
  beforeAll(async () => {
    await db.commit(a1, [event("test1", { value: "1" })]);
    await db.commit(a1, [event("test1", { value: "2" })]);
    await db.commit(a2, [event("test2", { value: "3" })]);
    await db.commit(a3, [event("test1", { value: "4" })]);
    await db.commit(a1, [event("test2", { value: "5" })]);
  });

  it("should read stream", async () => {
    const events = await db.read();
    expect(events.length).toBe(5);
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
