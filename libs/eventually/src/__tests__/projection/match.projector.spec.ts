import { client, app, dispose, ProjectionRecord, Operator } from "../../.";
import { MatchProjection, MatchProjector } from "./Match.projector";
import { steps, trace } from "./steps";

describe("match projection", () => {
  beforeAll(() => {
    app().with(MatchProjector).build();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should work", async () => {
    for (const step of steps) {
      let record: ProjectionRecord = { state: { id: "" }, watermark: -1 };
      await client().project(MatchProjector, step.event);
      await client().read(
        MatchProjector,
        step.event.stream,
        (r) => (record = r)
      );
      expect(record.state).toEqual(step.state);
      await trace();
    }
  });

  it("should query", async () => {
    const r = await client().read(MatchProjector, {}, (r) => r);
    expect(r).toBe(6);
  });

  it("should query manager 1", async () => {
    const results: Array<ProjectionRecord<MatchProjection>> = [];
    const r = await client().read(
      MatchProjector,
      {
        select: ["customerId"],
        where: {
          manager: { operator: Operator.eq, value: "New manager for 1" }
        },
        limit: 5,
        sort: { id: "asc" }
      },
      (r) => results.push(r)
    );
    expect(r).toBe(2);
    expect(results).toEqual([
      {
        state: {
          customerId: 101,
          customerName: "New customer name for 1",
          id: "Job-301",
          jobId: 301,
          jobTitle: "New job title for 1",
          manager: "New manager for 1"
        },
        watermark: 9
      },
      {
        state: {
          customerId: 101,
          customerName: "New customer name for 1",
          id: "Match-401",
          jobId: 301,
          jobTitle: "New job title for 1",
          manager: "New manager for 1",
          supplierId: 201,
          supplierName: "New supplier name for 1"
        },
        watermark: 9
      }
    ]);
  });

  it("should query with neq", async () => {
    const r = await client().read(
      MatchProjector,
      {
        where: {
          manager: { operator: Operator.neq, value: "New manager for 1" }
        }
      },
      (r) => r
    );
    expect(r).toBe(4);
  });

  it("should query with other operators", async () => {
    const r = await client().read(
      MatchProjector,
      {
        where: {
          jobId: { operator: Operator.gt, value: 20 },
          customerId: { operator: Operator.lt, value: 20 }
        }
      },
      (r) => r
    );
    expect(r).toBe(0);
  });

  it("should query with other operators 2", async () => {
    const r = await client().read(
      MatchProjector,
      {
        where: {
          jobId: { operator: Operator.gte, value: 20 },
          customerId: { operator: Operator.lte, value: 20 }
        }
      },
      (r) => r
    );
    expect(r).toBe(0);
  });

  it("should query with in/not_in", async () => {
    const r = await client().read(
      MatchProjector,
      {
        where: {
          jobId: { operator: Operator.in, value: 1 },
          customerId: { operator: Operator.not_in, value: 2 }
        }
      },
      (r) => r
    );
    expect(r).toBe(0);
  });
});
