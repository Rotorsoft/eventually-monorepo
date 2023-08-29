import {
  dispose,
  type Patch,
  type ProjectionRecord
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { z } from "zod";
import { PostgresProjectorStore } from "..";
import { config } from "../config";

enum TestEnum {
  On = "ON",
  Off = "OFF"
}
const ConstEnum = ["on", "off"] as const;

const zSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  age: z.number().optional(),
  hireDate: z.date().optional(),
  managerId: z.number().optional(),
  managerName: z.string().optional(),
  countryId: z.number().optional(),
  countryName: z.string().optional(),
  testEnum: z.nativeEnum(TestEnum).optional(),
  constEnum: z.enum(ConstEnum).optional()
});

type Schema = z.infer<typeof zSchema>;

const hireDate = new Date();
const insertRecords: Record<string, ProjectionRecord<Schema>> = {
  ["Manager-1"]: {
    state: { id: "Manager-1", managerId: 1, managerName: "Man One" },
    watermark: 6
  },
  ["Manager-2"]: {
    state: { id: "Manager-2", managerId: 2, managerName: "Man Two" },
    watermark: 6
  },
  ["Country-1"]: {
    state: { id: "Country-1", countryId: 1, countryName: "USA" },
    watermark: 6
  },
  ["Country-2"]: {
    state: { id: "Country-2", countryId: 2, countryName: "Cuba" },
    watermark: 6
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
    watermark: 6
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
    watermark: 6
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

const projectionMap = {
  records: new Map<string, Patch<Schema>>(),
  deletes: [],
  updates: []
};
Object.values(insertRecords).map((v) => {
  const { id, ...patch } = v.state;
  projectionMap.records.set(id, patch);
});

const table = "ProjectorTests";
describe("projector", () => {
  const pool = new Pool(config.pg);
  const db = PostgresProjectorStore<Schema>(table);

  beforeEach(async () => {
    await pool.query(`DROP TABLE IF EXISTS "${table}";`);
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
    const u1 = await db.commit(
      {
        records: new Map(Object.entries({ ["User-1"]: { age: 45 } })),
        deletes: [],
        updates: []
      },
      7
    );
    expect(u1.upserted).toBe(1);

    const u2 = await db.commit(
      {
        records: new Map(
          Object.entries({
            ["User-3"]: { name: "Pepe", age: 12 }
          })
        ),
        deletes: [],
        updates: []
      },
      7
    );
    expect(u2.upserted).toBe(1);

    const result = await db.load(["User-1", "User-3"]);
    expect(result[0].state.age).toEqual(45);
    expect(result[1].state.name).toEqual("Pepe");
    expect(result[1].state.age).toEqual(12);
  });

  it("should update records by filter", async () => {
    const newHire = new Date();
    const newManager = "New Manager";
    const ups = await db.commit(
      {
        records: new Map(),
        deletes: [],
        updates: [
          {
            age: 1,
            hireDate: newHire,
            managerName: newManager,
            where: { age: { gte: 40 } }
          }
        ]
      },
      7
    );
    expect(ups.upserted).toBe(2);

    const result = await db.load(["User-1", "User-2", "User-3"]);
    result.sort((a, b) => a.state.id.localeCompare(b.state.id));

    expect(result[0].state.age).toEqual(1);
    expect(result[0].state.hireDate).toEqual(newHire);
    expect(result[0].state.managerName).toEqual(newManager);

    expect(result[1].state.age).toEqual(1);
    expect(result[1].state.hireDate).toEqual(newHire);
    expect(result[1].state.managerName).toEqual(newManager);

    expect(result[2].state.age).not.toEqual(1);
    expect(result[2].state.hireDate).not.toEqual(newHire);
    expect(result[2].state.managerName).not.toEqual(newManager);
  });

  it("should delete record by id", async () => {
    const result = await db.commit(
      {
        records: new Map(Object.entries({ ["Country-1"]: {} })),
        deletes: [],
        updates: []
      },
      7
    );
    expect(result.deleted).toBe(1);
    const loaded = await db.load(["Country-1"]);
    expect(loaded[0]).toBeUndefined();
  });

  it("should delete records by filter", async () => {
    const result = await db.commit(
      {
        records: new Map(),
        deletes: [{ age: { gte: 40 } }],
        updates: []
      },
      7
    );
    expect(result.deleted).toBe(2);

    const loaded = await db.load(["User-1", "User-2", "User-3"]);
    expect(loaded.length).toBe(1);
  });

  it("should ignore low watermarks", async () => {
    const result1 = await db.commit(
      {
        records: new Map(Object.entries({ ["User-1"]: { age: 45 } })),
        deletes: [],
        updates: []
      },
      0
    );
    const result2 = await db.commit(
      {
        records: new Map(Object.entries({ ["Country-1"]: {} })),
        deletes: [],
        updates: []
      },
      0
    );
    expect(result1.upserted).toBe(0);
    expect(result2.deleted).toBe(0);
  });

  it("should query all", async () => {
    const records = await db.query({});
    expect(records.length).toBe(7);
  });

  it("should query by age", async () => {
    const records = await db.query({
      select: ["id", "name", "age", "countryName"],
      where: { age: { gte: 40 } },
      limit: 5,
      sort: { age: "desc" }
    });
    expect(records.length).toBe(2);
    expect([insertRecords["User-1"], insertRecords["User-2"]]).toMatchObject(
      records
    );
  });

  it("should query by country id", async () => {
    const records1 = await db.query({
      where: { countryId: { eq: 1 } }
    });
    const records2 = await db.query({
      where: { countryId: 1 }
    });
    expect(records1).toEqual(records2);
  });

  it("should query by age range", async () => {
    const records = await db.query({
      where: { age: { gt: 10, lte: 40 } }
    });
    expect(records.length).toEqual(1);
    expect(records.at(0)?.state.id).toEqual("User-2");
  });

  it("should query aggregates", async () => {
    const agg1 = await db.agg({
      select: { age: ["sum", "min", "max", "avg"] },
      where: { countryName: "USA" }
    });
    const agg2 = await db.agg({
      select: { id: ["count"], age: ["min", "sum"] }
    });

    expect(agg1.age?.sum).toEqual(84);
    expect(agg1.age?.min).toEqual(40);
    expect(agg1.age?.max).toEqual(44);
    expect(agg1.age?.avg).toBe(42);
    expect(agg2.id?.count).toEqual(7);
    expect(agg2.age?.min).toEqual(10);
    expect(agg2.age?.sum).toEqual(94);
  });
});
