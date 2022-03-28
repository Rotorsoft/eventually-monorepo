import { CommittedEvent, dispose, Payload } from "@rotorsoft/eventually";
import { Pool } from "pg";
import { PostgresSnapshotStore } from "..";
import { config } from "../config";

const table = "snapshots_test";
const db = PostgresSnapshotStore(table);

describe("snapshots", () => {
  const event: CommittedEvent<string, Payload> = {
    name: "testEvent",
    data: { value: "testValue" }
  } as unknown as CommittedEvent<string, Payload>;
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
    dispose()();
  });

  it("should insert snapshot with no error", async () => {
    const result = await db.upsert("snapshot1", { event, state });
    expect(result).toBeUndefined();

    const pgTable = await pool.query(`SELECT * FROM ${table}`);
    expect(pgTable.rows.length).toEqual(1);
    expect(pgTable.rows[0]).toEqual({
      stream: "snapshot1",
      data: { event, state }
    });
  });

  it("should update snapshot with no error", async () => {
    const result1 = await db.upsert("snapshot1", { event, state });
    const result2 = await db.upsert("snapshot1", {
      event,
      state: { value: "some other updated state" }
    });
    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();

    const pgTable = await pool.query(`SELECT * FROM ${table}`);
    expect(pgTable.rows.length).toEqual(1);
    expect(pgTable.rows[0]).toEqual({
      stream: "snapshot1",
      data: { event, state: { value: "some other updated state" } }
    });
  });

  it("should read stream by name", async () => {
    await db.upsert("snapshot2", { event, state });
    const result = await db.read("snapshot2");
    expect(result.event).toEqual(event);
    expect(result.state).toEqual(state);
  });
});
