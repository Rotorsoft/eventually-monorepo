import { Chance } from "chance";
import { Msg, Payload, Evt, EvtOf } from "@rotorsoft/eventually";
import { PostgresStore } from "..";

const db = PostgresStore("test");

const chance = new Chance();
const a1 = chance.guid();
const a2 = chance.guid();
const a3 = chance.guid();

type E = {
  test1: { value: string };
  test2: { value: string };
  test3: { value: string };
};

const event = (name: keyof E, data?: Payload): Msg =>
  ({
    name,
    data,
    schema: () => null
  } as Msg);

describe("PostgresStore", () => {
  beforeAll(async () => {
    await db.init();
    await db.init();
    await db.commit(a1, [event("test1", { value: "1" })]);
    await db.commit(a1, [event("test1", { value: "2" })]);
    await db.commit(a2, [event("test2", { value: "3" })]);
    await db.commit(a3, [event("test1", { value: "4" })]);
    await db.commit(a1, [event("test2", { value: "5" })]);
    await db.commit(
      a1,
      [
        event("test3", { value: "1" }),
        event("test3", { value: "2" }),
        event("test3", { value: "3" })
      ],
      undefined,
      () => Promise.resolve()
    );
  });

  afterAll(async () => {
    await db.close();
  });

  it("should commit events", async () => {
    let first: number,
      count = 0;
    await db.read(
      (e) => {
        first = first || e.id;
        count++;
      },
      { stream: a1 }
    );
    expect(first).toBeGreaterThan(0);
    expect(count).toBe(6);
  });

  it("should commit events array", async () => {
    const events: Evt[] = [];
    await db.read(
      (e) => {
        events.push(e);
      },
      { stream: a1 }
    );
    const l = events.length;
    expect(l).toBeGreaterThan(2);
    expect(events[l - 1].data).toStrictEqual({ value: "3" });
    expect(events[l - 2].data).toStrictEqual({ value: "2" });
    expect(events[l - 3].data).toStrictEqual({ value: "1" });
  });

  it("should throw concurrency error", async () => {
    await expect(db.commit(a1, [event("test2")], 1)).rejects.toThrowError(
      "Concurrency Error"
    );
  });

  it("should read stream with after", async () => {
    const events: EvtOf<E>[] = [];
    await db.read((e) => events.push(e), { after: 2, limit: 2 });
    expect(events[0].id).toBe(3);
    expect(events.length).toBe(2);
  });

  it("should read stream by name", async () => {
    const events: EvtOf<E>[] = [];
    await db.read((e) => events.push(e), { name: "test1", limit: 5 });
    expect(events[0].name).toBe("test1");
    expect(events.length).toBeGreaterThanOrEqual(3);
    events.map((evt) => expect(evt.name).toBe("test1"));
  });

  it("should read stream with limit", async () => {
    const events: EvtOf<E>[] = [];
    await db.read((e) => events.push(e), { limit: 5 });
    expect(events.length).toBe(5);
  });
});
