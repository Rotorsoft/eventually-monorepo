import { bind, store } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import {
  PostgresStreamListenerFactory,
  PostgresSubscriptionStore,
  StreamListener,
  subscriptions,
  TriggerCallback
} from "..";

store(PostgresStore("channel_test"));
subscriptions(PostgresSubscriptionStore("listener_test"));

describe("listener", () => {
  let listener: StreamListener;
  let pumped = 0;

  const pump: TriggerCallback = () => {
    pumped++;
    return Promise.resolve();
  };

  beforeAll(async () => {
    listener = PostgresStreamListenerFactory();
    await listener.listen("id1", new URL("pg://channel_test"), pump);
  });

  afterAll(async () => {
    await listener.close();
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
