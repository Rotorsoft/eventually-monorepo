import Chance from "chance";
import { PostgresSubscriptionStore, subscriptions } from "..";
import { createService } from "./utils";

const chance = Chance();
subscriptions(PostgresSubscriptionStore());

describe("services", () => {
  beforeAll(async () => {
    await subscriptions().init();
    await subscriptions().init();
  });

  afterAll(async () => {
    await subscriptions().close();
    await subscriptions().close();
  });

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
