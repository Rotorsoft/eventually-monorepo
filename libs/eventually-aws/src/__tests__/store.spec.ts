import { dispose, store, subscriptions } from "@rotorsoft/eventually";
import { DynamoStore, DynamoSubscriptionStore } from "..";
import { randomUUID } from "crypto";

const table = "StoreTest";
store(DynamoStore(table));
subscriptions(DynamoSubscriptionStore(table + "_subscriptions"));

describe("dynamo stores", () => {
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
  });
});
