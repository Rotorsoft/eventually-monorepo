import {
  store,
  Subscription,
  subscriptions,
  TriggerCallback
} from "@rotorsoft/eventually";
import { PostgresSubscriptionStore, PostgresStreamListener } from "..";
import { event, sleep } from "./utils";

const channel = "channel_test";
const sub: Subscription = {
  id: "id1",
  channel,
  streams: "",
  names: "",
  endpoint: "",
  active: true
};

subscriptions(PostgresSubscriptionStore("listener_test"));

describe("listener", () => {
  let closeListener: () => Promise<void>;
  let pumped = 0;

  const pump: TriggerCallback = () => {
    pumped++;
    return Promise.resolve();
  };

  beforeAll(async () => {
    closeListener = await PostgresStreamListener(sub, pump);
  });

  afterAll(async () => {
    await closeListener();
  });

  it("should trigger subscription", async () => {
    await store().commit("aggregate1", [event("test3", { value: "1" })], {
      correlation: "",
      causation: {}
    });
    await sleep(2000);
    expect(pumped).toBeGreaterThan(0);
  });
});
