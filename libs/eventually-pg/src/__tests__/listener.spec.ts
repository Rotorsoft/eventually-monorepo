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

const db = store(PostgresStore(channel));
subscriptions(PostgresSubscriptionStore());

describe("listener", () => {
  beforeAll(async () => {
    await db.init();
  });

  afterAll(async () => {
    await db.close();
  });

  it("should trigger subscription", async () => {
    let pumped = false;
    const pump: TriggerCallback = () => {
      pumped = true;
      return Promise.resolve();
    };
    const close = await PostgresStreamListener(sub, pump);
    await db.commit("aggregate1", [event("test3", { value: "1" })], {
      correlation: "",
      causation: {}
    });
    await sleep(500);
    expect(pumped).toBeTruthy();
    await close();
  });
});
