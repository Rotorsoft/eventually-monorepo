import { dispose } from "@rotorsoft/eventually";
import { config } from "@rotorsoft/eventually-pg";
import Chance from "chance";
import { Pool } from "pg";
import { PostgresSubscriptionStore, subscriptions } from "..";
import { createService, createSubscription } from "./utils";

const chance = Chance();
subscriptions(PostgresSubscriptionStore());
const pool = new Pool(config.pg);

describe("crud", () => {
  beforeAll(async () => {
    await subscriptions().seed();
    await pool.query("delete from subscriptions; delete from services;");
  });

  afterAll(async () => {
    await dispose()();
    await pool.end();
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

    it("should update a subscription", async () => {
      const id = chance.name();
      await createSubscription(id, service);
      const [sub] = await subscriptions().loadSubscriptions(id);
      const newPath = chance.name();
      sub.path = newPath;
      await subscriptions().updateSubscription(sub);
      const [updated] = await subscriptions().loadSubscriptions(id);
      expect(updated.path).toBe(newPath);
    });

    it("should delete a subscription", async () => {
      const id = chance.name();
      await createSubscription(id, service);
      const [sub] = await subscriptions().loadSubscriptions(id);
      expect(sub.id).toBe(id);
      await subscriptions().deleteSubscription(id);
      const [deleted] = await subscriptions().loadSubscriptions(id);
      expect(deleted).toBeUndefined();
    });

    it("should load subscriptions by producer", async () => {
      const id = chance.name();
      await createSubscription(id, service);
      const subs = await subscriptions().loadSubscriptionsByProducer(service);
      expect(subs.length).toBeGreaterThanOrEqual(1);
    });

    it("should find subscription", async () => {
      const id = chance.name();
      await createSubscription(id, service);
      const subs = await subscriptions().searchSubscriptions(
        service.substring(0, 1)
      );
      expect(subs.length).toBeGreaterThanOrEqual(1);
    });

    it("should activate a subscription", async () => {
      const id = chance.name();
      await createSubscription(id, service);
      const [sub] = await subscriptions().loadSubscriptions(id);
      expect(sub.active).toBeFalsy();
      await subscriptions().toggleSubscription(id);
      const [updated] = await subscriptions().loadSubscriptions(id);
      expect(updated.active).toBeTruthy();
    });

    it("should commit position", async () => {
      const id1 = chance.name();
      const id2 = chance.name();
      const producer = chance.name();
      await createService(producer);
      await createSubscription(id1, producer);
      await createSubscription(id2, producer);
      await subscriptions().commitSubscriptionPosition(id1, 10);
      await subscriptions().commitSubscriptionPosition(id2, 11);
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
