import { CommittedEvent, dispose } from "@rotorsoft/eventually";
import { Pool } from "pg";
import { PostgresSnapshotStore } from "..";
import { config } from "../config";

const table = "snapshots_test";
const db = PostgresSnapshotStore(table, 5);

describe("snapshots", () => {
  const event: CommittedEvent = {
    name: "testEvent",
    data: { value: "testValue" }
  } as unknown as CommittedEvent;
  const state = { value: "Some test state" };
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool(config.pg);
    await pool.query(`DROP TABLE IF EXISTS ${table};`);
    await db.seed();
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE TABLE ${table}`);
  });

  afterAll(async () => {
    await pool.end();
    await dispose()();
  });

  it("should insert snapshot with no error", async () => {
    const result = await db.upsert("snapshot1", {
      event,
      state,
      applyCount: 0
    });
    expect(result).toBeUndefined();

    const pgTable = await pool.query(`SELECT * FROM ${table}`);
    expect(pgTable.rows.length).toEqual(1);
    expect(pgTable.rows[0]).toEqual({
      stream: "snapshot1",
      data: { event, state, applyCount: 0 }
    });
  });

  it("should update snapshot with no error", async () => {
    const result1 = await db.upsert("snapshot1", {
      event,
      state,
      applyCount: 0
    });
    const result2 = await db.upsert("snapshot1", {
      event,
      state: { value: "some other updated state" },
      applyCount: 0
    });
    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();

    const pgTable = await pool.query(`SELECT * FROM ${table}`);
    expect(pgTable.rows.length).toEqual(1);
    expect(pgTable.rows[0]).toEqual({
      stream: "snapshot1",
      data: {
        event,
        state: { value: "some other updated state" },
        applyCount: 0
      }
    });
  });

  it("should read stream by name", async () => {
    await db.upsert("snapshot2", { event, state, applyCount: 0 });
    const result = await db.read("snapshot2");
    expect(result.event).toEqual(event);
    expect(result.state).toEqual(state);
  });

  it("should query", async () => {
    await db.upsert("snapshot2", { event, state, applyCount: 0 });
    const result = await db.query({ limit: 1 });
    expect(result[0].event).toEqual(event);
    expect(result[0].state).toEqual(state);
  });
});
