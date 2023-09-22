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
        data: { a: 1, recorded: new Date() }
      },
      {
        name: "Event2",
        data: { b: false, recorded: new Date() }
      },
      {
        name: "Event3",
        data: { c: "abc", recorded: new Date() }
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

    const l = await store().query((e) => expect(e.stream).toBe(stream), {
      stream
    });
    expect(l).toBe(6);
  });
});
