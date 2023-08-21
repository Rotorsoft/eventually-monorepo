import { client, app, dispose } from "../../.";
import { MatchProjector } from "./Match.projector";
import { steps, trace } from "./steps";

describe("match projection", () => {
  beforeAll(async () => {
    app().with(MatchProjector).build();
    await client().project(
      MatchProjector,
      steps.map((step) => step.event)
    );
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should work", async () => {
    const states = (
      await client().read(
        MatchProjector,
        steps.map((step) => step.event.stream)
      )
    ).map((r) => r.state);
    expect(states).toEqual([
      { id: "Customer-101", customerId: 101 },
      { id: "Supplier-201", supplierId: 201 },
      { id: "Job-301", jobId: 301, customerId: 101, manager: "Manager 1" },
      { id: "Job-302", jobId: 302, customerId: 102, manager: "Manager 2" },
      { id: "Customer-102", customerId: 102 },
      { id: "Match-401", jobId: 301, supplierId: 201 }
    ]);

    await trace();
  });

  it("should query", async () => {
    const r = await client().read(MatchProjector, {});
    expect(r.length).toBe(6);
  });

  it("should query manager 1", async () => {
    const results = await client().read(MatchProjector, {
      select: ["customerId"],
      where: { manager: "Manager 1" },
      limit: 5,
      sort: { id: "asc" }
    });
    expect(results.length).toBe(1);
    expect(results).toEqual([
      {
        state: {
          customerId: 101,
          id: "Job-301",
          jobId: 301,
          manager: "Manager 1"
        },
        watermark: 5
      }
    ]);
  });

  it("should query with neq", async () => {
    const r = await client().read(MatchProjector, {
      where: {
        manager: { neq: "Manager 1" }
      }
    });
    expect(r.length).toBe(5);
  });

  it("should query with other operators", async () => {
    const r = await client().read(MatchProjector, {
      where: {
        jobId: { gt: 20 },
        customerId: { lt: 20 }
      }
    });
    expect(r.length).toBe(0);
  });

  it("should query with other operators 2", async () => {
    const r = await client().read(MatchProjector, {
      where: {
        jobId: { gte: 20 },
        customerId: { lte: 20 }
      }
    });
    expect(r.length).toBe(0);
  });

  it("should query with in/not_in", async () => {
    const r = await client().read(MatchProjector, {
      where: {
        jobId: { in: 1 },
        customerId: { nin: 2 }
      }
    });
    expect(r.length).toBe(0);
  });

  it("should aggregate with filters", async () => {
    const r = await client().agg(MatchProjector, {
      select: { id: ["count"], jobId: ["sum", "min", "max", "avg"] },
      where: {
        customerId: { gt: 100, lt: 200 }
      }
    });
    expect(r.id?.count).toBe(4);
    expect(r.jobId?.min).toBe(301);
    expect(r.jobId?.max).toBe(302);
    expect(r.jobId?.sum).toBe(603);
    expect(r.jobId?.avg).toBe(301.5);
  });
});
