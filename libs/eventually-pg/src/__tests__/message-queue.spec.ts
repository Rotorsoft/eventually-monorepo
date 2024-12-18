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

  it("should propagate handler errors to dequeue caller", async () => {
    // Enqueue a test message
    await mq.enqueue([
      { name: "test", stream: "error-test", data: { value: "error" } }
    ]);

    // Create a handler that throws an error
    const errorMessage = "Test error from handler";
    const handler = () => {
      throw new Error(errorMessage);
    };

    // Verify that the error is propagated
    await expect(mq.dequeue(handler, { stream: "error-test" })).rejects.toThrow(
      errorMessage
    );

    // try to immediately dequeue again with successful handler
    expect(await mq.dequeue(async () => {}, { stream: "error-test" })).toBe(true)
  });

  it("should handle concurrent dequeue attempts correctly", async () => {
    // Enqueue multiple messages
    await mq.enqueue([
      { name: "concurrent", stream: "concurrent-test", data: { value: "1" } },
      { name: "concurrent", stream: "concurrent-test", data: { value: "2" } },
      { name: "concurrent", stream: "concurrent-test", data: { value: "3" } }
    ]);

    const processedMessages = new Set<string>();
    const processingTimes = new Map<string, number>();

    // Create a handler that simulates long-running processing
    const handler = async (message: Message) => {
      const value = message.data.value as string;
      
      // Ensure message wasn't processed before
      expect(processedMessages.has(value)).toBeFalsy();
      
      // Record processing start time
      processingTimes.set(value, Date.now());
      
      // Simulate processing time
      await sleep(500);
      
      processedMessages.add(value);
    };

    // Run multiple dequeue operations concurrently
    await Promise.all([
      mq.dequeue(handler, { stream: "concurrent-test" }),
      mq.dequeue(handler, { stream: "concurrent-test" }),
      mq.dequeue(handler, { stream: "concurrent-test" })
    ]);

    // Verify each message was processed exactly once
    expect(processedMessages.size).toBe(3);
    expect(processedMessages).toContain("1");
    expect(processedMessages).toContain("2");
    expect(processedMessages).toContain("3");

    // Verify messages were processed in parallel
    const times = Array.from(processingTimes.values());
    const maxTimeDiff = Math.max(...times) - Math.min(...times);
    expect(maxTimeDiff).toBeLessThan(20); // Should start within 100ms of each other
  });

  it("should maintain message order within a single consumer", async () => {
    await mq.enqueue([
      { name: "order", stream: "order-test", data: { value: "1" } },
      { name: "order", stream: "order-test", data: { value: "2" } },
      { name: "order", stream: "order-test", data: { value: "3" } }
    ]);

    const processedOrder: string[] = [];
    const handler = (message: Message) => {
      processedOrder.push(message.data.value as string);
      return Promise.resolve();
    };

    // Process all messages sequentially
    await mq.dequeue(handler, { stream: "order-test" });
    await mq.dequeue(handler, { stream: "order-test" });
    await mq.dequeue(handler, { stream: "order-test" });

    // Verify messages were processed in order
    expect(processedOrder).toEqual(["1", "2", "3"]);
  });

  it("should handle transaction rollback on error correctly", async () => {
    await mq.enqueue([
      { name: "rollback", stream: "rollback-test", data: { value: "1" } }
    ]);

    let attempts = 0;
    const failHandler = () => {
      attempts++;
      throw new Error("Simulated failure");
    };

    const successHandler = async () => {
      attempts++;
      return Promise.resolve();
    };

    // First attempt should fail
    await expect(
      mq.dequeue(failHandler, { stream: "rollback-test" })
    ).rejects.toThrow("Simulated failure");

    // Message should be immediately available for retry
    await expect(
      mq.dequeue(failHandler, { stream: "rollback-test" })
    ).rejects.toThrow("Simulated failure");
    expect(attempts).toBe(2); // Handler should have been called twice
    
    // should still be able to dequeue and process successfully
    await expect(
      mq.dequeue(successHandler, { stream: "rollback-test" })
    ).resolves.toBe(true);
    expect(attempts).toBe(3);

    //should not dequeue anything since stream should be empty
    await expect(
      mq.dequeue(successHandler, { stream: "rollback-test" })
    ).resolves.toBe(false);
    // shuld still be 3 attempts since we processed one message
    expect(attempts).toBe(3);
  
  });
});
