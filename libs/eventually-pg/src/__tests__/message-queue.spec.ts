import { dispose, Message, sleep } from "@rotorsoft/eventually";
import { PostgresMessageQueue } from "..";

const table = "message_queue_test";
const mq = PostgresMessageQueue(table);

describe("message queue", () => {
  beforeAll(async () => {
    await mq.drop();
    await mq.seed();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should enqueue and dequeue", async () => {
    await mq.enqueue([{ name: "a", stream: "test", data: { value: "1" } }]);
    await mq.enqueue([
      { name: "a", stream: "test", data: { value: "2" } },
      { name: "a", stream: "test", data: { value: "3" } },
      { name: "a", stream: "test", data: { value: "4" } }
    ]);
    await mq.enqueue([{ name: "a", stream: "test", data: { value: "5" } }]);

    // should dequeue in order
    const messages: Message[] = [];
    await mq.dequeue(
      (message) => {
        messages.push(message);
        return Promise.resolve();
      },
      { stream: "test" }
    );
    expect(messages.length).toBe(1);

    // should not dequeue if stream is locked
    await Promise.all([
      // should lock the stream for 1 second
      mq.dequeue(
        async (message) => {
          await sleep(1000);
          messages.push(message);
        },
        { stream: "test" }
      ),
      // the stream should be locked for 1 second, thus should not dequeue
      async () => {
        await sleep(300);
        await mq.dequeue(
          async (message) => {
            messages.push(message);
            return Promise.resolve();
          },
          { stream: "test" }
        );
        expect(messages.length).toBe(1);
      }
    ]);

    // should be able to dequeue again
    await mq.dequeue(
      (message) => {
        messages.push(message);
        return Promise.resolve();
      },
      { stream: "test" }
    );
    expect(messages.length).toBe(3);
  });
});
