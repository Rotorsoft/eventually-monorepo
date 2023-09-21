import {
  dispose,
  type Patch,
  type ProjectionRecord
} from "@rotorsoft/eventually";
import { z } from "zod";
import { DynamoProjectorStore } from "..";

enum TestEnum {
  On = "ON",
  Off = "OFF"
}
const ConstEnum = ["on", "off"] as const;

const zSchema = z.object({
  partition: z.string(),
  id: z.string(),
  name: z.string().optional(),
  age: z.coerce.number().optional(),
  hireDate: z.coerce.date().optional(),
  managerId: z.coerce.number().optional(),
  managerName: z.string().optional(),
  countryId: z.coerce.number().optional(),
  countryName: z.string().optional(),
  testEnum: z.nativeEnum(TestEnum).optional(),
  constEnum: z.enum(ConstEnum).optional()
});

type Schema = z.infer<typeof zSchema>;

const hireDate = new Date();
hireDate.setMilliseconds(0); // zod coerce fix

const insertRecords: Record<string, ProjectionRecord<Schema>> = {
  ["Manager-1"]: {
    state: {
      partition: "employees",
      id: "Manager-1",
      managerId: 1,
      managerName: "Man One"
    },
    watermark: 6
  },
  ["Manager-2"]: {
    state: {
      partition: "employees",
      id: "Manager-2",
      managerId: 2,
      managerName: "Man Two"
    },
    watermark: 6
  },
  ["Country-1"]: {
    state: {
      partition: "employees",
      id: "Country-1",
      countryId: 1,
      countryName: "USA"
    },
    watermark: 6
  },
  ["Country-2"]: {
    state: {
      partition: "employees",
      id: "Country-2",
      countryId: 2,
      countryName: "Cuba"
    },
    watermark: 6
  },
  ["User-1"]: {
    state: {
      partition: "employees",
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
      partition: "employees",
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
      partition: "employees",
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
  const db = DynamoProjectorStore<Schema>(table, "partition", zSchema);

  beforeEach(async () => {
    await db.drop();
    await db.seed(zSchema, []);
    await db.commit(projectionMap, 6);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should have inserted records", async () => {
    for (const r of Object.values(insertRecords)) {
      const result = await db.query({
        where: {
          partition: "employees",
          id: r.state.id
        }
      });
      const clean = Object.entries(result.at(0)!.state)
        .filter(([, v]) => v !== null)
        .reduce((p, [k, v]) => Object.assign(p, { [k]: v }), {} as Schema);
      expect(insertRecords[r.state.id].state).toEqual(clean);
      expect(r.watermark).toBe(6);
    }
  });

  it("should update records by id", async () => {
    const u1 = await db.commit(
      {
        records: new Map(
          Object.entries({ ["User-1"]: { partition: "employees", age: 45 } })
        ),
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
            ["User-3"]: { partition: "employees", name: "Pepe", age: 12 }
          })
        ),
        deletes: [],
        updates: []
      },
      7
    );
    expect(u2.upserted).toBe(1);

    const result1 = await db.query({
      where: { partition: "employees", id: "User-1" }
    });
    expect(result1[0].state.age).toEqual(45);

    const result2 = await db.query({
      where: { partition: "employees", id: "User-3" }
    });
    expect(result2[0].state.age).toEqual(12);
    expect(result2[0].state.name).toEqual("Pepe");
  });

  it("should delete record by id", async () => {
    const result = await db.commit(
      {
        records: new Map(
          Object.entries({ ["Country-1"]: { partition: "employees" } })
        ),
        deletes: [],
        updates: []
      },
      7
    );
    expect(result.deleted).toBe(1);
    const loaded = await db.query({
      where: { partition: "employees", id: "Country-1" }
    });
    expect(loaded[0]).toBeUndefined();
  });

  it("should ignore low watermarks", async () => {
    const result1 = await db.commit(
      {
        records: new Map(
          Object.entries({ ["User-1"]: { partition: "employees", age: 45 } })
        ),
        deletes: [],
        updates: []
      },
      0
    );
    const result2 = await db.commit(
      {
        records: new Map(
          Object.entries({ ["Country-1"]: { partition: "employees" } })
        ),
        deletes: [],
        updates: []
      },
      0
    );
    expect(result1.upserted).toBe(0);
    expect(result2.deleted).toBe(0);
  });

  it("should query all", async () => {
    const records = await db.query({ where: { partition: "employees" } });
    expect(records.length).toBe(7);
  });

  it("should query by age", async () => {
    const records = await db.query({
      select: ["id", "name", "age", "countryName"],
      where: { partition: "employees", age: { gte: 40 } },
      limit: 10,
      sort: { age: "desc" }
    });
    expect(records.length).toBe(2);
    expect([insertRecords["User-1"], insertRecords["User-2"]]).toMatchObject(
      records
    );
  });

  it("should query by country id", async () => {
    const records1 = await db.query({
      where: { partition: "employees", countryId: { eq: 1 } }
    });
    const records2 = await db.query({
      where: { partition: "employees", countryId: 1 }
    });
    expect(records1).toEqual(records2);
  });

  it("should query by age range", async () => {
    const records = await db.query({
      where: { partition: "employees", age: { gt: 10, lte: 40 } }
    });
    expect(records.length).toEqual(1);
    expect(records.at(0)?.state.id).toEqual("User-2");
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  // it("should query aggregates", async () => {
  //   const agg1 = await db.agg({
  //     select: { age: ["sum", "min", "max", "avg"] },
  //     where: { countryName: "USA" }
  //   });
  //   const agg2 = await db.agg({
  //     select: { id: ["count"], age: ["min", "sum"] }
  //   });

  //   expect(agg1.age?.sum).toEqual(84);
  //   expect(agg1.age?.min).toEqual(40);
  //   expect(agg1.age?.max).toEqual(44);
  //   expect(agg1.age?.avg).toBe(42);
  //   expect(agg2.id?.count).toEqual(7);
  //   expect(agg2.age?.min).toEqual(10);
  //   expect(agg2.age?.sum).toEqual(94);
  // });
});
