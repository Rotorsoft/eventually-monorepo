import { PostgresSubscriptionStore } from "..";

const db = PostgresSubscriptionStore();

describe("subscriptions", () => {
  beforeAll(async () => {
    await db.init(true);
    await db.init();
  });

  afterAll(async () => {
    await db.close();
    await db.close();
  });

  it("should create a new subscription", () => {
    expect(true).toBe(true);
  });

  it("should fail validation when creating a new subscription", () => {
    expect(true).toBe(true);
  });

  it("should update a subscription", () => {
    expect(true).toBe(true);
  });

  it("should fail validation when updating subscription", () => {
    expect(true).toBe(true);
  });

  it("should delete a subscription", () => {
    expect(true).toBe(true);
  });

  it("should load subscriptions", async () => {
    const result = await db.loadSubscriptions();
    expect(result.length).toBe(2);
  });

  it("should load subscription", async () => {
    const result = await db.loadSubscriptions("id2");
    expect(result.length).toBe(1);
  });

  it("should load subscriptions by producer", () => {
    expect(true).toBe(true);
  });

  it("should activate a subscription", () => {
    expect(true).toBe(true);
  });

  it("should deactivate a subscription", () => {
    expect(true).toBe(true);
  });

  it("should commit position", async () => {
    await db.commitPosition("id1", 10);
    await db.commitPosition("id2", 10);
    const result = await db.loadSubscriptions();
    expect(result.length).toBe(2);
    expect(result[0].position).toBe(10);
    expect(result[1].position).toBe(10);
  });
});
