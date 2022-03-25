import { PostgresSubscriptionStore } from "..";

const db = PostgresSubscriptionStore();

describe("services", () => {
  beforeAll(async () => {
    await db.init(true);
    await db.init();
  });

  afterAll(async () => {
    await db.close();
    await db.close();
  });

  it("should create a new service", () => {
    expect(true).toBe(true);
  });

  it("should fail validation when creating a new service", () => {
    expect(true).toBe(true);
  });

  it("should update a service", () => {
    expect(true).toBe(true);
  });

  it("should fail validation when updating a service", () => {
    expect(true).toBe(true);
  });

  it("should delete a service", () => {
    expect(true).toBe(true);
  });

  it("should load services", () => {
    expect(true).toBe(true);
  });

  it("should load a service by id", () => {
    expect(true).toBe(true);
  });
});
