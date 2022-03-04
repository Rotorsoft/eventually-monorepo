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
  it("should trigger subscription", async () => {
    let pumped = false;
    const pump: TriggerCallback = () => {
      pumped = true;
      return Promise.resolve();
    };
    const close = await PostgresStreamListener(sub, pump);
    await store().commit("aggregate1", [event("test3", { value: "1" })], {
      correlation: "",
      causation: {}
    });
    await sleep(1000);
    expect(pumped).toBeTruthy();
    await close();
  });
});
