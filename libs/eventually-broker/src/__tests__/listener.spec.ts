import { bind, CommittedEvent, dispose, store } from "@andela-technology/eventually";
import { PostgresStore } from "@andela-technology/eventually-pg";
import {
  PostgresStreamListener,
  PostgresSubscriptionStore,
  subscriptions,
  TriggerCallback
} from "..";

const stream = "channel_test";
store(PostgresStore(stream));
subscriptions(PostgresSubscriptionStore());

describe("listener", () => {
  let pumped = 0;
  const pump: TriggerCallback = () => {
    pumped++;
    return Promise.resolve();
  };
  const listener = PostgresStreamListener(stream);

  beforeAll(async () => {
    await store().seed();
  });

  afterAll(async () => {
    await listener.close();
    await dispose()();
  });

  it("should trigger subscription", async () => {
    await listener.listen(pump);
    await store().commit(
      "aggregate1",
      [
        bind("test3", {
          value: "1"
        }) as CommittedEvent
      ],
      {
        correlation: "",
        causation: {}
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(pumped).toBeGreaterThan(0);
  });
});
