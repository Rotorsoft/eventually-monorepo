import { bind, dispose, store } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import {
  PostgresStreamListenerFactory,
  PostgresSubscriptionStore,
  subscriptions,
  TriggerCallback
} from "..";

store(PostgresStore("channel_test"));
subscriptions(PostgresSubscriptionStore());

describe("listener", () => {
  let pumped = 0;
  const pump: TriggerCallback = () => {
    pumped++;
    return Promise.resolve();
  };

  beforeAll(async () => {
    PostgresStreamListenerFactory("id1", new URL("pg://channel_test"), pump);
    await store().seed();
  });

  afterAll(() => {
    dispose()();
  });

  it("should trigger subscription", async () => {
    await store().commit("aggregate1", [bind("test3", { value: "1" })], {
      correlation: "",
      causation: {}
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(pumped).toBeGreaterThan(0);
  });
});
