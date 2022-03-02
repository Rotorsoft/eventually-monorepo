import {
  store,
  Subscription,
  subscriptions,
  TriggerCallback
} from "@rotorsoft/eventually";
import {
  PostgresStore,
  PostgresSubscriptionStore,
  PostgresStreamListener
} from "..";
import { event, sleep } from "./utils";

const channel = "test_channel";

const sub: Subscription = {
  id: "id1",
  channel,
  streams: "",
  names: "",
  endpoint: "",
  active: true
};

store(PostgresStore(channel));
subscriptions(PostgresSubscriptionStore());

describe("PostgresSubscriptionStore", () => {
  beforeAll(async () => {
    await store().init();
  });

  afterAll(async () => {
    await store().close();
  });

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
