import { dispose, store } from "@rotorsoft/eventually";
import { DynamoStore } from "../DynamoStore";
import { randomUUID } from "crypto";

describe.skip("store", () => {
  beforeAll(async () => {
    store(DynamoStore("TestDynamoStore"));
    await store().seed();
  });

  afterAll(async () => {
    await store().reset();
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

    await store().query((e) => console.log(e), { stream });
  });
});
