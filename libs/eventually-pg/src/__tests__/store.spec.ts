import { CommittedEvent, STATE_EVENT } from "@rotorsoft/eventually";
import { Chance } from "chance";
import { PostgresStore } from "..";
import { event, sleep } from "./utils";

const table = "store_test";
const db = PostgresStore(table);

const chance = new Chance();
const a1 = chance.guid();
const a2 = chance.guid();
const a3 = chance.guid();
const a4 = chance.guid();
const a5 = chance.guid();
const pm = chance.guid();
let created_before: Date;
let created_after: Date;

describe("pg", () => {
  beforeAll(async () => {
    await db.seed();
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("should commit and query", async () => {
    const query_correlation = chance.guid();

    await db.commit(a1, [event("test1", { value: "1" })], {
      correlation: "",
      causation: {
        command: { name: "", actor: { id: pm, name: "" } }
      }
    });
    created_after = new Date();
    await sleep(200);

    await db.commit(a1, [event("test1", { value: "2" })], {
      correlation: query_correlation,
      causation: {}
    });
    await db.commit(a2, [event("test2", { value: "3" })], {
      correlation: "",
      causation: {
        command: { name: "", actor: { id: pm, name: "" } }
      }
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
      { correlation: query_correlation, causation: {} },
      undefined
    );

    let first = 0;
    const events: CommittedEvent[] = [];
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

    const events2: CommittedEvent[] = [];
    await db.query((e) => events2.push(e), { after: 2, limit: 2 });
    expect(events2[0].id).toBe(3);
    expect(events2.length).toBe(2);

    const events3: CommittedEvent[] = [];
    await db.query((e) => events3.push(e), { names: ["test1"], limit: 5 });
    expect(events3[0].name).toBe("test1");
    expect(events3.length).toBeGreaterThanOrEqual(3);
    events3.map((evt) => expect(evt.name).toBe("test1"));

    expect(await db.query(() => 0, { after: 2, before: 4 })).toBe(1);

    expect(
      await db.query(() => 0, {
        stream: a1,
        created_after,
        created_before
      })
    ).toBe(2);

    expect(await db.query(() => 0, { limit: 5 })).toBe(5);

    expect(
      await db.query(() => 0, {
        limit: 10,
        correlation: query_correlation
      })
    ).toBe(4);

    expect(
      await db.query(() => 0, {
        limit: 10,
        actor: pm
      })
    ).toBe(2);

    await expect(
      db.commit(
        a1,
        [event("test2", { value: "" })],
        { correlation: "", causation: {} },
        1
      )
    ).rejects.toThrow();
  });

  it("should commit and load with state", async () => {
    await db.commit(
      a4,
      [
        event("test3", { value: "1" }),
        event("test3", { value: "2" }),
        event("test3", { value: "3" })
      ],
      { correlation: "", causation: {} }
    );
    await db.commit(
      a5,
      [event("test2", { value: "333" }), event("test2", { value: "334" })],
      {
        correlation: "",
        causation: {}
      }
    );
    await db.commit(
      a4,
      [
        event(STATE_EVENT, { value: "1" }),
        event("test3", { value: "2" }),
        event("test3", { value: "3" })
      ],
      {
        correlation: "",
        causation: {}
      }
    );

    const count = await db.query(() => {}, {
      stream: a4,
      loading: true
    });
    expect(count).toBe(3);
    const count2 = await db.query(() => {}, {
      stream: a5,
      loading: true
    });
    expect(count2).toBe(2);
  });

  it("should get store stats", async () => {
    const stats = await db.stats();
    expect(stats).toBeDefined();
  });

  it("should poll", async () => {
    const lease = await db.poll("test", ["test1"], 5, 5000);
    expect(lease?.events.length).toBeGreaterThanOrEqual(3);
    const acked = await db.ack(lease!, 5);
    expect(acked).toBeTruthy();
  });
});
