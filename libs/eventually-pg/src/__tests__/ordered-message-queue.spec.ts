import { dispose, Message, sleep } from "@rotorsoft/eventually";
import { PostgresOrderedMessageQueue } from "../PostgresOrderedMessageQueue";

const table = "ordered_message_queue_test";
const mq = PostgresOrderedMessageQueue(table);

describe("message queue", () => {
  beforeAll(async () => {
    await mq.drop();
    await mq.seed();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should enqueue and dequeue in order", async () => {
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
    const result1 = await mq.dequeue(handler, { stream: "order-test" });
    const result2 = await mq.dequeue(handler, { stream: "order-test" });
    const result3 = await mq.dequeue(handler, { stream: "order-test" });

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(true);
    expect(processedOrder).toEqual(["1", "2", "3"]);

    // Verify no more messages
    const emptyResult = await mq.dequeue(handler, { stream: "order-test" });
    expect(emptyResult).toBe(false);
  });

  it("should handle transaction rollback on error", async () => {
    await mq.enqueue([
      { name: "rollback", stream: "rollback-test", data: { value: "1" } }
    ]);

    let attempts = 0;
    const failHandler = () => {
      attempts++;
      throw new Error("Simulated failure");
    };

    // First attempt should fail and rollback
    await expect(
      mq.dequeue(failHandler, { stream: "rollback-test" })
    ).rejects.toThrow("Simulated failure");

    // Message should be available for retry
    const successHandler = () => {
      attempts++;
      return Promise.resolve();
    };
    const result = await mq.dequeue(successHandler, { stream: "rollback-test" });
    expect(result).toBe(true);
    expect(attempts).toBe(2);

    // Stream should be empty
    const emptyResult = await mq.dequeue(successHandler, { stream: "rollback-test" });
    expect(emptyResult).toBe(false);
  });

  it("should prevent concurrent processing of same stream", async () => {
    // Enqueue first message
    await mq.enqueue([
      { name: "concurrent", stream: "stream-test", data: { value: "1" } },
    ]);

    const processedMessages: string[] = [];
    let firstMessageStarted = false;
    const processingMessage = new Promise<void>((resolve) => {
      setTimeout(resolve, 200);
    });

    const handler = async (message: Message) => {
      const value = message.data.value as string;
      processedMessages.push(value);
      
      if (value === "1") {
        firstMessageStarted = true;  // Signal that first message processing has started
        await processingMessage;
      }
    };

    // Start first dequeue
    const dequeue1Promise = mq.dequeue(handler, { stream: "stream-test" });
    
    // Wait for first message to actually start processing
    while (!firstMessageStarted) {
      await sleep(10);
    }
    
    // Now we know the lock is held, proceed with second message
    await mq.enqueue([
      { name: "concurrent", stream: "stream-test", data: { value: "2" } },
    ]);

    const dequeue2Promise = mq.dequeue(handler, { stream: "stream-test" });

    const [result1, result2] = await Promise.all([
      dequeue1Promise,
      dequeue2Promise
    ]);

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    
    // Only the first message should be processed
    expect(processedMessages).toEqual(["1"]);

    // Now we should be able to process the second message
    const result3 = await mq.dequeue(handler, { stream: "stream-test" });
    expect(result3).toBe(true);
    expect(processedMessages).toEqual(["1", "2"]);
  });

  it("should allow concurrent processing of different streams", async () => {
    await mq.enqueue([
      { name: "multi", stream: "stream-1", data: { value: "1" } },
      { name: "multi", stream: "stream-2", data: { value: "2" } }
    ]);

    const processedMessages: string[] = [];
    const handler = async (message: Message) => {
      await sleep(100); // Simulate processing time
      processedMessages.push(message.data.value as string);
    };

    // Process different streams concurrently
    const [result1, result2] = await Promise.all([
      mq.dequeue(handler, { stream: "stream-1" }),
      mq.dequeue(handler, { stream: "stream-2" })
    ]);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(processedMessages.length).toBe(2);
    expect(new Set(processedMessages)).toEqual(new Set(["1", "2"]));
  });

  it("should handle unstreamed messages", async () => {
    await mq.enqueue([
      { name: "unstreamed", data: { value: "1" } },
      { name: "unstreamed", data: { value: "2" } }
    ]);

    const processedMessages: string[] = [];
    const handler = (message: Message) => {
      processedMessages.push(message.data.value as string);
      return Promise.resolve();
    };

    const result1 = await mq.dequeue(handler, {});
    const result2 = await mq.dequeue(handler, {});
    const result3 = await mq.dequeue(handler, {});

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(false); // No more messages
    expect(processedMessages.length).toBe(2);
  });

  it("should respect lease duration", async () => {
    await mq.enqueue([
      { name: "lease", stream: "lease-test", data: { value: "1" } }
    ]);

    // First handler that will fail
    const handler1 = () => {
      throw new Error('Simulated failure');
    };

    const result1 = await mq.dequeue(handler1, { 
      stream: "lease-test",
      leaseMillis: 100 
    }).catch(() => false);

    await sleep(150);
    
    const result2 = await mq.dequeue(() => Promise.resolve(), 
      { stream: "lease-test" }
    );
    
    expect(result1).toBe(false);  // First handler failed
    expect(result2).toBe(true);   // Second handler should succeed
  });

  it("should prevent message processing during aggressive concurrent attempts", async () => {
    // Increase timeout since we're doing lots of concurrent operations
    jest.setTimeout(30000);

    // Enqueue initial messages for two different streams
    await mq.enqueue([
      { name: "aggressive", stream: "aggressive-test-1", data: { value: "1" } },
      { name: "aggressive", stream: "aggressive-test-2", data: { value: "2" } }
    ]);

    const processedMessages: string[] = [];
    let firstStreamStarted = false;
    let secondStreamStarted = false;
    const processingDelay = new Promise<void>(resolve => setTimeout(resolve, 500));

    const slowHandler = async (message: Message) => {
      const value = message.data.value as string;
      processedMessages.push(value);
      
      if (value === "1") {
        firstStreamStarted = true;
      }
      if (value === "2") {
        secondStreamStarted = true;
      }
      await processingDelay;
    };

    // Start processing both streams without specifying streams
    const firstDequeue = mq.dequeue(slowHandler);
    const secondDequeue = mq.dequeue(slowHandler);

    // Wait for both streams to start processing
    while (!firstStreamStarted || !secondStreamStarted) {
      await sleep(10);

    }

    // Try to aggressively process messages while first ones are still processing
    // Reduced number of concurrent attempts to avoid connection pool exhaustion
    const attempts = 100;
    const concurrentAttempts = Array(attempts).fill(null).map(() => 
      mq.dequeue(slowHandler)
    );

    const results = await Promise.all([firstDequeue, secondDequeue, ...concurrentAttempts]);

    // First two dequeues should succeed, all others should fail
    expect(results[0]).toBe(true);
    expect(results[1]).toBe(true);
    results.slice(2).forEach(result => {
      expect(result).toBe(false);
    });

    // Only first two messages should be processed
    expect(processedMessages).toHaveLength(2);
    expect(new Set(processedMessages)).toEqual(new Set(["1", "2"]));

  }); // Set timeout at test level as well

  it("should dequeue any message when no stream name is provided", async () => {
    // Enqueue messages with and without streams
    await mq.enqueue([
      { name: "no-opts", stream: "stream-1", data: { value: "1" } },
      { name: "no-opts", data: { value: "2" } },  // No stream
      { name: "no-opts", stream: "stream-2", data: { value: "3" } }
    ]);

    const processedMessages: string[] = [];
    const handler = async (message: Message) => {
      processedMessages.push(message.data.value as string);
      await sleep(100);
    };

    // Dequeue without providing any options
    const result1 = await mq.dequeue(handler);
    const result2 = await mq.dequeue(handler);
    const result3 = await mq.dequeue(handler);
    const result4 = await mq.dequeue(handler);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(true);
    expect(result4).toBe(false);  // No more messages
    expect(processedMessages.length).toBe(3);
    expect(new Set(processedMessages)).toEqual(new Set(["1", "2", "3"]));
  });
});
