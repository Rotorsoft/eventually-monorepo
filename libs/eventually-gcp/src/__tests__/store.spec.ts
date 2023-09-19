import { dispose, store, subscriptions } from "@rotorsoft/eventually";
import { FirestoreStore, FirestoreSubscriptionStore } from "..";
import { randomUUID } from "crypto";

const table = "StoreTest";
store(FirestoreStore(table));
subscriptions(FirestoreSubscriptionStore(table + "_subscriptions"));

describe("firestore stores", () => {
  beforeAll(async () => {
    await store().drop();
    await subscriptions().drop();
    await store().seed();
    await subscriptions().seed();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should commit", async () => {
    const stream = "my-stream";

    const events = [
      {
        name: "Event1",
        data: { a: 1 }
      },
      {
        name: "Event2",
        data: { b: false }
      },
      {
        name: "Event3",
        data: { c: "abc" }
      }
    ];
    const committed = await store().commit(stream, events, {
      correlation: randomUUID(),
      causation: {
        command: {
          name: "CommandName",
          actor: {
            id: "actor-id",
            name: "actor-name"
          }
        }
      }
    });
    expect(committed.length).toBe(events.length);

    const committed2 = await store().commit(
      stream,
      events,
      {
        correlation: randomUUID(),
        causation: {
          command: {
            name: "CommandName",
            actor: {
              id: "actor-id",
              name: "actor-name"
            }
          }
        }
      },
      2
    );
    expect(committed2.length).toBe(events.length);

    // polling
    const lease = await subscriptions().poll("test", {
      names: ["Event1", "Event2"],
      timeout: 5000,
      limit: 5
    });
    expect(lease?.events.length).toBeGreaterThanOrEqual(3);
    const acked = await subscriptions().ack(lease!, 5);
    expect(acked).toBeTruthy();
  });
});
