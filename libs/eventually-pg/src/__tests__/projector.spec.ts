import {
  dispose,
  type ProjectionPatch,
  type ProjectionRecord,
  type ProjectorStore
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { PostgresProjectorStore } from "..";
import { config } from "../config";
import { z } from "zod";

const zSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  age: z.number().optional(),
  hireDate: z.date().optional(),
  managerId: z.number().optional(),
  managerName: z.string().optional(),
  countryId: z.number().optional(),
  countryName: z.string().optional()
});

type Schema = z.infer<typeof zSchema>;

const hireDate = new Date();
const insertRecords: Record<string, ProjectionRecord<Schema>> = {
  ["Manager-1"]: {
    state: { id: "Manager-1", managerId: 1, managerName: "Man One" },
    watermark: 0
  },
  ["Manager-2"]: {
    state: { id: "Manager-2", managerId: 2, managerName: "Man Two" },
    watermark: 1
  },
  ["Country-1"]: {
    state: { id: "Country-1", countryId: 1, countryName: "USA" },
    watermark: 2
  },
  ["Country-2"]: {
    state: { id: "Country-2", countryId: 2, countryName: "Cuba" },
    watermark: 3
  },
  ["User-1"]: {
    state: {
      id: "User-1",
      name: "John Doe",
      age: 44,
      hireDate,
      managerId: 1,
      managerName: "Man One",
      countryId: 1,
      countryName: "USA"
    },
    watermark: 4
  },
  ["User-2"]: {
    state: {
      id: "User-2",
      name: "Jane Doe",
      age: 40,
      hireDate,
      managerId: 1,
      managerName: "Man One",
      countryId: 1,
      countryName: "USA"
    },
    watermark: 5
  },
  ["User-3"]: {
    state: {
      id: "User-3",
      name: "Pepito",
      age: 10,
      hireDate,
      managerId: 2,
      managerName: "Man Two",
      countryId: 2,
      countryName: "Cuba"
    },
    watermark: 6
  }
};

const projectionMap = new Map<string, ProjectionPatch<Schema>>();
Object.entries(insertRecords).map(([k, v]) => projectionMap.set(k, v.state));

const table = "ProjectorTests";
describe("projector", () => {
  let pool: Pool;
  let db: ProjectorStore<Schema>;

  beforeAll(async () => {
    pool = new Pool(config.pg);
    await pool.query(`DROP TABLE IF EXISTS "${table}";`);

    db = PostgresProjectorStore<Schema>(table);
    await db.seed(zSchema, [{ managerId: "asc" }, { countryId: "asc" }]);
    await db.commit(projectionMap, 6);
  });

  afterAll(async () => {
    await pool.end();
    await dispose()();
  });

  it("should have inserted records", async () => {
    const result = await db.load(Object.keys(insertRecords));
    result.forEach((r) => {
      const clean = Object.entries(r.state)
        .filter(([, v]) => v !== null)
        .reduce((p, [k, v]) => Object.assign(p, { [k]: v }), {});
      expect(insertRecords[r.state.id].state).toEqual(clean);
      expect(r.watermark).toBe(6);
    });
  });

  it("should update records by id", async () => {
    let result = await db.load(["User-1", "User-3"]);
    await db.commit(
      new Map(Object.entries({ ["User-1"]: { id: "User-1", age: 45 } })),
      result[0].watermark + 1
    );
    await db.commit(
      new Map(
        Object.entries({ ["User-3"]: { id: "User-3", name: "Pepe", age: 12 } })
      ),
      result[1].watermark + 1
    );
    result = await db.load(["User-1", "User-3"]);
    expect(result[0].state.age).toEqual(45);
    expect(result[1].state.name).toEqual("Pepe");
    expect(result[1].state.age).toEqual(12);
  });

  it("should delete records", async () => {
    let loaded = await db.load(["Country-1"]);
    const result = await db.commit(
      new Map(Object.entries({ ["Country-1"]: { id: "Country-1" } })),
      loaded[0].watermark + 1
    );
    expect(result.deleted).toBe(1);
    loaded = await db.load(["Country-1"]);
    expect(loaded[0]).toBeUndefined();
  });

  it("should ignore low watermarks", async () => {
    const result1 = await db.commit(
      new Map(Object.entries({ ["User-1"]: { id: "User-1", age: 45 } })),
      0
    );
    const result2 = await db.commit(
      new Map(Object.entries({ ["Country-1"]: { id: "Country-1" } })),
      0
    );
    expect(result1.upserted).toBe(0);
    expect(result2.deleted).toBe(0);
  });

  it("should query all", async () => {
    const records = await db.query({});
    expect(records.length).toBe(6);
  });

  it("should query by age", async () => {
    const records = await db.query({
      select: ["id", "name", "age", "countryName"],
      where: { age: { operator: "gte", value: 40 } },
      limit: 5,
      sort: { age: "desc" }
    });
    expect(records.length).toBe(2);
    expect(records).toEqual([
      {
        state: {
          age: 45,
          countryName: "USA",
          id: "User-1",
          name: "John Doe"
        },
        watermark: 7
      },
      {
        state: {
          age: 40,
          countryName: "USA",
          id: "User-2",
          name: "Jane Doe"
        },
        watermark: 6
      }
    ]);
  });

  it("should query by country id", async () => {
    const records1 = await db.query({
      where: { countryId: { operator: "eq", value: 1 } }
    });
    const records2 = await db.query({
      where: { countryId: 1 }
    });
    expect(records1).toEqual(records2);
  });
});
