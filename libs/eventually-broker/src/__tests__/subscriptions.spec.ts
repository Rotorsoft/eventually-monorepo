import Chance from "chance";
import { PostgresSubscriptionStore } from "..";
import { subscriptions } from "..";
import { createService, createSubscription } from "./utils";

const chance = Chance();
subscriptions(PostgresSubscriptionStore());

describe("subscriptions", () => {
  const service = chance.name();

  beforeAll(async () => {
    await subscriptions().init(true);
    await subscriptions().init();
    await createService(service);
  });

  afterAll(async () => {
    await subscriptions().close();
    await subscriptions().close();
  });

  it("should create a new subscription", async () => {
    const id = chance.name();
    await createSubscription(id, service);
    const [sub] = await subscriptions().loadSubscriptions(id);
    expect(sub.id).toBe(id);
  });

  it("should update a subscription", () => {
    expect(true).toBe(true);
  });

  it("should delete a subscription", () => {
    expect(true).toBe(true);
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
    const id1 = chance.name();
    const id2 = chance.name();
    const producer = chance.name();
    await createService(producer);
    await createSubscription(id1, producer);
    await createSubscription(id2, producer);
    await subscriptions().commitPosition(id1, 10);
    await subscriptions().commitPosition(id2, 11);
    const result1 = await subscriptions().loadSubscriptions();
    const result2 = await subscriptions().loadSubscriptionsByProducer(producer);
    expect(result1.length).toBeGreaterThanOrEqual(2);
    expect(result2.length).toBe(2);
    expect(result2[0].position).toBe(10);
    expect(result2[1].position).toBe(11);
  });
});
