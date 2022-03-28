import { dispose } from "@rotorsoft/eventually";
import Chance from "chance";
import { PostgresSubscriptionStore, subscriptions } from "..";
import { createService, createSubscription } from "./utils";

const chance = Chance();
subscriptions(PostgresSubscriptionStore());

describe("crud", () => {
  beforeAll(async () => {
    await subscriptions().seed();
  });
  afterAll(() => {
    dispose()();
  });

  describe("services", () => {
    it("should create a new service", async () => {
      const id = chance.name();
      await createService(id);
      const [service] = await subscriptions().loadServices(id);
      expect(service.id).toBe(id);
    });

    it("should update a service", async () => {
      const id = chance.name();
      await createService(id);
      const [service] = await subscriptions().loadServices(id);
      const newUrl = chance.url();
      service.url = newUrl;
      await subscriptions().updateService(service);
      const [updated] = await subscriptions().loadServices(id);
      expect(updated.url).toBe(newUrl);
    });

    it("should delete a service", async () => {
      const id = chance.name();
      await createService(id);
      const [service] = await subscriptions().loadServices(id);
      expect(service.id).toBe(id);
      await subscriptions().deleteService(id);
      const [deleted] = await subscriptions().loadServices(id);
      expect(deleted).toBeUndefined();
    });

    it("should load services", async () => {
      await createService(chance.name());
      await createService(chance.name());
      const loaded = await subscriptions().loadServices();
      expect(loaded.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("subscriptions", () => {
    const service = chance.name();

    beforeAll(async () => {
      await subscriptions().seed();
      await createService(service);
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
      const result2 = await subscriptions().loadSubscriptionsByProducer(
        producer
      );
      expect(result1.length).toBeGreaterThanOrEqual(2);
      expect(result2.length).toBe(2);
      expect(result2[0].position).toBe(10);
      expect(result2[1].position).toBe(11);
    });
  });
});
