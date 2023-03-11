import {
  dispose,
  Operator,
  Projection,
  ProjectionRecord,
  ProjectorStore
} from "@rotorsoft/eventually";
import { Pool } from "pg";
import { PostgresProjectorStore } from "..";
import { config } from "../config";

type Schema = {
  id: string;
  name?: string;
  age?: number;
  hireDate?: Date;
  managerId?: number;
  managerName?: string;
  countryId?: number;
  countryName?: string;
};

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
      hireDate: new Date(),
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
      hireDate: new Date(),
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
      hireDate: new Date(),
      managerId: 2,
      managerName: "Man Two",
      countryId: 2,
      countryName: "Cuba"
    },
    watermark: 6
  }
};

const projections: Array<Projection<Schema>> = Object.values(insertRecords).map(
  (r) => {
    const { id, ...other } = r.state;
    return { upserts: [{ where: { id }, values: { ...other } }] };
  }
);

const table = "projector_tests";
describe("projector", () => {
  let pool: Pool;
  let db: ProjectorStore<Schema>;

  beforeAll(async () => {
    pool = new Pool(config.pg);
    await pool.query(`DROP TABLE IF EXISTS ${table};`);

    db = PostgresProjectorStore<Schema>(
      table,
      {
        id: 'varchar(100) COLLATE pg_catalog."default" NOT NULL PRIMARY KEY',
        name: 'varchar(100) COLLATE pg_catalog."default"',
        age: "int",
        hireDate: "timestamptz",
        managerId: "int",
        managerName: 'varchar(100) COLLATE pg_catalog."default"',
        countryId: "int",
        countryName: 'varchar(100) COLLATE pg_catalog."default"'
      },
      `
CREATE INDEX IF NOT EXISTS ${table}_managerId_ix ON public.${table} USING btree ("managerId" ASC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS ${table}_countryId_ix ON public.${table} USING btree ("countryId" ASC) TABLESPACE pg_default;`
    );
    await db.seed();

    for (let i = 0; i < projections.length; i++) {
      await db.commit(projections[i], i);
    }
  });

  afterAll(async () => {
    await pool.end();
    await dispose()();
  });

  it("should have inserted records", async () => {
    const result = await db.load(Object.keys(insertRecords));
    Object.values(insertRecords).forEach((r, i) => {
      const clean = Object.entries(result[i].state)
        .filter(([, v]) => v !== null)
        .reduce((p, [k, v]) => Object.assign(p, { [k]: v }), {});
      expect(r.state).toEqual(clean);
      expect(r.watermark).toBe(result[i].watermark);
    });
  });

  it("should update records by id", async () => {
    let result = await db.load(["User-1", "User-3"]);
    await db.commit(
      { upserts: [{ where: { id: "User-1" }, values: { age: 45 } }] },
      result[0].watermark + 1
    );
    await db.commit(
      {
        upserts: [
          { where: { id: "User-3" }, values: { name: "Pepe", age: 12 } }
        ]
      },
      result[1].watermark + 1
    );
    result = await db.load(["User-1", "User-3"]);
    expect(result[0].state.age).toEqual(45);
    expect(result[1].state.name).toEqual("Pepe");
    expect(result[1].state.age).toEqual(12);
  });

  it("should update records by fk", async () => {
    let result = await db.load(["User-1", "User-2"]);
    const water = Math.max(result[0].watermark, result[1].watermark) + 1;
    await db.commit(
      {
        upserts: [
          {
            where: { countryId: 1 },
            values: { countryName: "United States of America" }
          }
        ]
      },
      water
    );
    await db.commit(
      {
        upserts: [
          { where: { managerId: 1 }, values: { managerName: "Manager One" } }
        ]
      },
      water
    );
    result = await db.load(["User-1", "User-2"]);

    expect(result[0].state.countryName).toEqual("United States of America");
    expect(result[1].state.countryName).toEqual("United States of America");
    expect(result[0].state.managerName).toEqual("Manager One");
    expect(result[1].state.managerName).toEqual("Manager One");
  });

  it("should delete records", async () => {
    let loaded = await db.load(["Country-1"]);
    const result = await db.commit(
      { deletes: [{ where: { countryId: 1 } }] },
      loaded[0].watermark + 1
    );
    expect(result.deleted).toBe(1);
    loaded = await db.load(["Country-1"]);
    expect(loaded[0]).toBeUndefined();
  });

  it("should ignore low watermarks", async () => {
    const result1 = await db.commit(
      { upserts: [{ where: { id: "User-1" }, values: { age: 45 } }] },
      0
    );
    const result2 = await db.commit(
      {
        upserts: [{ where: { countryId: 1 }, values: { countryName: "test" } }]
      },
      0
    );
    const result3 = await db.commit(
      { deletes: [{ where: { countryId: 1 } }] },
      0
    );
    expect(result1.upserted).toBe(0);
    expect(result2.upserted).toBe(0);
    expect(result3.deleted).toBe(0);
  });

  it("should query all", async () => {
    const r = await db.query({}, (r) => r);
    expect(r).toBe(6);
  });

  it("should query by age", async () => {
    const records: Array<ProjectionRecord<Schema>> = [];
    const r = await db.query(
      {
        select: ["id", "name", "age", "countryName"],
        where: { age: { operator: Operator.gte, value: 40 } },
        limit: 5,
        sort: { age: "desc" }
      },
      (r) => records.push(r)
    );
    expect(r).toBe(2);
    expect(records).toEqual([
      {
        state: {
          age: 45,
          countryName: "United States of America",
          id: "User-1",
          name: "John Doe"
        },
        watermark: 4
      },
      {
        state: {
          age: 40,
          countryName: "United States of America",
          id: "User-2",
          name: "Jane Doe"
        },
        watermark: 5
      }
    ]);
  });
});
