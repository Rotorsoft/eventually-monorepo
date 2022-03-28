import { CommittedEvent, dispose, Payload } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { PostgresStore } from "..";
import { event, sleep } from "./utils";

const table = "store_test";
const db = PostgresStore(table);

const chance = new Chance();
const a1 = chance.guid();
const a2 = chance.guid();
const a3 = chance.guid();
let created_before: Date;
let created_after: Date;

describe("pg", () => {
  beforeAll(async () => {
    await db.seed();
  });

  afterAll(() => {
    dispose()();
  });

  it("should commit and query", async () => {
    await db.commit(a1, [event("test1", { value: "1" })], {
      correlation: "",
      causation: {}
    });
    created_after = new Date();
    await sleep(200);

    await db.commit(a1, [event("test1", { value: "2" })], {
      correlation: "",
      causation: {}
    });
    await db.commit(a2, [event("test2", { value: "3" })], {
      correlation: "",
      causation: {}
    });
    await db.commit(a3, [event("test1", { value: "4" })], {
      correlation: "",
      causation: {}
    });

    await db.commit(a1, [event("test2", { value: "5" })], {
      correlation: "",
      causation: {}
    });

    await sleep(200);
    created_before = new Date();
    await sleep(200);

    await db.commit(
      a1,
      [
        event("test3", { value: "1" }),
        event("test3", { value: "2" }),
        event("test3", { value: "3" })
      ],
      { correlation: "", causation: {} },
      undefined
    );

    let first: number;
    const events: CommittedEvent<string, Payload>[] = [];
    await db.query(
      (e) => {
        first = first || e.id;
        events.push(e);
      },
      { stream: a1 }
    );
    expect(first).toBeGreaterThan(0);
    const l = events.length;
    expect(l).toBe(6);
    expect(events[l - 1].data).toStrictEqual({ value: "3" });
    expect(events[l - 2].data).toStrictEqual({ value: "2" });
    expect(events[l - 3].data).toStrictEqual({ value: "1" });

    const events2: CommittedEvent<string, Payload>[] = [];
    await db.query((e) => events2.push(e), { after: 2, limit: 2 });
    expect(events2[0].id).toBe(3);
    expect(events2.length).toBe(2);

    const events3: CommittedEvent<string, Payload>[] = [];
    await db.query((e) => events3.push(e), { names: ["test1"], limit: 5 });
    expect(events3[0].name).toBe("test1");
    expect(events3.length).toBeGreaterThanOrEqual(3);
    events3.map((evt) => expect(evt.name).toBe("test1"));

    const events4: CommittedEvent<string, Payload>[] = [];
    await db.query((e) => events4.push(e), { after: 2, before: 4 });
    expect(events4.length).toBe(1);

    const events5: CommittedEvent<string, Payload>[] = [];
    await db.query((e) => events5.push(e), {
      stream: a1,
      created_after,
      created_before
    });
    expect(events5.length).toBe(2);

    const events6: CommittedEvent<string, Payload>[] = [];
    await db.query((e) => events6.push(e), { limit: 5 });
    expect(events6.length).toBe(5);

    await expect(
      db.commit(a1, [event("test2")], { correlation: "", causation: {} }, 1)
    ).rejects.toThrowError("Concurrency Error");
  });

  it("should get store stats", async () => {
    const stats = await db.stats();
    expect(stats).toBeDefined();
  });
});
