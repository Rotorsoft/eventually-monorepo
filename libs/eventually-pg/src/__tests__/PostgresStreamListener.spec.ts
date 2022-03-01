import { store, Subscription, TriggerCallback } from "@rotorsoft/eventually";
import {
  PostgresStore,
  PostgresSubscriptionStore,
  PostgresStreamListener
} from "..";
import { event, sleep } from "./utils";

const sub: Subscription = {
  id: "id1",
  channel: "test",
  streams: "",
  names: "",
  endpoint: "",
  active: true
};
const db = PostgresSubscriptionStore();

describe("PostgresSubscriptionStore", () => {
  beforeAll(async () => {
    store(PostgresStore("test"));
    await store().init();
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
    await PostgresStreamListener(sub, pump);
    await store().commit("stream", [event("test3", { value: "1" })], {
      correlation: "",
      causation: {}
    });
    await sleep(1000);
    expect(pumped).toBeTruthy();
  });
});
