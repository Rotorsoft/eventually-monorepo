import { dispose, log, Message, sleep } from "@rotorsoft/eventually";
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
    expect(await mq.dequeue(async () => {}, { stream: "error-test" })).toBe(
      true
    );
  });

  it("should handle concurrent dequeue attempts correctly", async () => {
    // Enqueue multiple messages
    await mq.enqueue([
      { name: "concurrent", stream: "concurrent-test", data: { value: "1" } },
      { name: "concurrent", stream: "concurrent-test-2", data: { value: "2" } },
      { name: "concurrent", stream: "concurrent-test-3", data: { value: "3" } }
    ]);

    const processedMessages = new Set<string>();
    const processingTimes = new Map<string, number>();
    const processingOrder = [] as string[];

    // Create a handler that simulates long-running processing
    const handler = async (message: Message) => {
      const value = message.data.value as string;
      const stream = message.stream;

      log().info(`Starting to process message ${value} from stream ${stream}`);

      // Record processing start time
      const startTime = Date.now();
      processingTimes.set(value, startTime);

      // Simulate processing time
      await sleep(500);

      log().info(`Finished processing message ${value} from stream ${stream}`);

      // Ensure message wasn't processed before
      if (processedMessages.has(value)) {
        throw new Error(`Message ${value} was processed more than once!`);
      }

      processedMessages.add(value);
      processingOrder.push(value);
    };

    // Run multiple dequeue operations concurrently
    const results = await Promise.all([
      mq.dequeue(handler, { stream: "concurrent-test" }),
      mq.dequeue(handler, { stream: "concurrent-test-2" }),
      mq.dequeue(handler, { stream: "concurrent-test-3" })
    ]);

    // Log the results
    log().info("Processing order:", processingOrder);
    log().info("Processing times:", Object.fromEntries(processingTimes));
    log().info("Dequeue results:", results);

    // Verify each message was processed exactly once
    expect(processedMessages.size).toBe(3);
    expect(processedMessages).toContain("1");
    expect(processedMessages).toContain("2");
    expect(processedMessages).toContain("3");

    // Verify all dequeues were successful
    expect(results.filter((r) => r === true).length).toBe(3);

    // Verify messages were processed in parallel
    const times = Array.from(processingTimes.values());
    const maxTimeDiff = Math.max(...times) - Math.min(...times);
    log().info(
      `Max time difference between message processing: ${maxTimeDiff}ms`
    );
    expect(maxTimeDiff).toBeLessThan(100);
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
    const result1 = await mq.dequeue(handler, { stream: "order-test" });
    const result2 = await mq.dequeue(handler, { stream: "order-test" });
    const result3 = await mq.dequeue(handler, { stream: "order-test" });

    // Verify all dequeues were successful
    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(true);

    // Verify messages were processed in order
    expect(processedOrder).toEqual(["1", "2", "3"]);

    // Verify no more messages are available
    const emptyResult = await mq.dequeue(handler, { stream: "order-test" });
    expect(emptyResult).toBe(false);
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

    const successHandler = () => {
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
    const successResult = await mq.dequeue(successHandler, {
      stream: "rollback-test"
    });
    expect(successResult).toBe(true);
    expect(attempts).toBe(3);

    //should not dequeue anything since stream should be empty
    const emptyResult = await mq.dequeue(successHandler, {
      stream: "rollback-test"
    });
    expect(emptyResult).toBe(false);
    // should still be 3 attempts since we processed one message
    expect(attempts).toBe(3);
  });

  it("should prevent processing multiple messages from same stream concurrently", async () => {
    // Enqueue multiple messages for the same stream
    await mq.enqueue([
      { name: "stream-lock", stream: "stream-lock-test", data: { value: "1" } },
      { name: "stream-lock", stream: "stream-lock-test", data: { value: "2" } },
      { name: "stream-lock", stream: "stream-lock-test", data: { value: "3" } }
    ]);

    let currentlyProcessing = false;
    const processedMessages: string[] = [];
    const processingStarts: { value: string; time: number }[] = [];
    const processingEnds: { value: string; time: number }[] = [];

    // Create a handler that tracks concurrent processing
    const handler = async (message: Message): Promise<void> => {
      const value = message.data.value as string;
      const startTime = Date.now();

      log().info(`Attempting to process message ${value}`);
      processingStarts.push({ value, time: startTime });

      // Assert that no other message from this stream is being processed
      if (currentlyProcessing) {
        throw new Error(`Concurrent processing detected for message ${value}`);
      }

      currentlyProcessing = true;

      // Simulate some processing time
      await sleep(500);

      processedMessages.push(value);
      currentlyProcessing = false;

      const endTime = Date.now();
      processingEnds.push({ value, time: endTime });
      log().info(`Finished processing message ${value}`);
    };

    // Try to process messages concurrently
    const dequeuePromises = [
      mq.dequeue(handler, { stream: "stream-lock-test" }),
      mq.dequeue(handler, { stream: "stream-lock-test" }),
      mq.dequeue(handler, { stream: "stream-lock-test" })
    ];

    const results = await Promise.all(dequeuePromises);

    // Log processing details
    log().info("Processed messages in order:", processedMessages);
    log().info("Processing starts:", processingStarts);
    log().info("Processing ends:", processingEnds);
    log().info("Dequeue results:", results);

    // Only one dequeue operation should succeed
    const successCount = results.filter((result) => result === true).length;
    expect(successCount).toBe(1);

    // Only one message should be processed
    expect(processedMessages.length).toBe(1);
    expect(processedMessages[0]).toBe("1"); // Should be the first message

    // Now we should be able to process the next message
    const result2 = await mq.dequeue(handler, { stream: "stream-lock-test" });
    expect(result2).toBe(true);
    expect(processedMessages.length).toBe(2);
    expect(processedMessages[1]).toBe("2"); // Should be the second message

    // And the final message
    const result3 = await mq.dequeue(handler, { stream: "stream-lock-test" });
    expect(result3).toBe(true);
    expect(processedMessages.length).toBe(3);
    expect(processedMessages[2]).toBe("3"); // Should be the third message

    // Verify messages were processed in order
    expect(processedMessages).toEqual(["1", "2", "3"]);

    // Verify no more messages are available
    const emptyResult = await mq.dequeue(handler, {
      stream: "stream-lock-test"
    });
    expect(emptyResult).toBe(false);
  });

  it("should handle unstreamed messages correctly", async () => {
    // Enqueue multiple unstreamed messages
    await mq.enqueue([
      { name: "unstreamed", data: { value: "1" } },
      { name: "unstreamed", data: { value: "2" } },
      { name: "unstreamed", data: { value: "3" } },
      { name: "unstreamed", data: { value: "4" } }
    ]);

    const processedMessages: string[] = [];
    const processing = new Set<string>();
    let maxConcurrent = 0;
    const processingOrder: string[] = [];

    // Create a promise that resolves when first message starts processing
    let firstProcessingResolve: () => void;
    const firstProcessingPromise = new Promise<void>((resolve) => {
      firstProcessingResolve = resolve;
    });

    // Try to process multiple messages concurrently
    const results = await Promise.all([
      mq.dequeue(
        async (message) => {
          const value = message.data.value as string;
          processing.add(value);
          maxConcurrent = Math.max(maxConcurrent, processing.size);
          processingOrder.push(`start-${value}`);

          if (processing.size === 1) {
            firstProcessingResolve();
            // First message waits longer
            await sleep(100);
          } else {
            // Subsequent messages process faster
            await sleep(50);
          }

          processingOrder.push(`end-${value}`);
          processing.delete(value);
          processedMessages.push(value);
        },
        { stream: undefined }
      ),

      // Wait for first message to start processing before starting others
      (async () => {
        await firstProcessingPromise;
        return mq.dequeue(
          async (message) => {
            const value = message.data.value as string;
            processing.add(value);
            maxConcurrent = Math.max(maxConcurrent, processing.size);
            processingOrder.push(`start-${value}`);
            await sleep(50);
            processingOrder.push(`end-${value}`);
            processing.delete(value);
            processedMessages.push(value);
          },
          { stream: undefined }
        );
      })(),

      (async () => {
        await firstProcessingPromise;
        return mq.dequeue(
          async (message) => {
            const value = message.data.value as string;
            processing.add(value);
            maxConcurrent = Math.max(maxConcurrent, processing.size);
            processingOrder.push(`start-${value}`);
            await sleep(50);
            processingOrder.push(`end-${value}`);
            processing.delete(value);
            processedMessages.push(value);
          },
          { stream: undefined }
        );
      })()
    ]);

    // Verify concurrent processing occurred
    expect(maxConcurrent).toBeGreaterThan(1);

    // Should have processed multiple messages
    // eslint-disable-next-line require-await
    const successCount = results.filter((r) => r === true).length;
    expect(successCount).toBeGreaterThan(1);

    // Process remaining message
    while (processedMessages.length < 4) {
      const result = await mq.dequeue(
        (message) => {
          const value = message.data.value as string;
          processingOrder.push(`start-${value}`);
          processingOrder.push(`end-${value}`);
          processedMessages.push(value);
          return Promise.resolve();
        },
        { stream: undefined }
      );
      expect(result).toBe(true);
    }

    // Verify all messages were processed
    expect(processedMessages.length).toBe(4);
    expect(new Set(processedMessages)).toEqual(new Set(["1", "2", "3", "4"]));

    // Verify concurrent processing by checking processing order
    const startIndices = processingOrder
      .map((entry, index) => (entry.startsWith("start-") ? index : -1))
      .filter((index) => index !== -1);

    const endIndices = processingOrder
      .map((entry, index) => (entry.startsWith("end-") ? index : -1))
      .filter((index) => index !== -1);

    // Verify that at least one message started processing before another finished
    const hasOverlap = startIndices.some(
      (startIdx, i) => i > 0 && startIdx < endIndices[i - 1]
    );
    expect(hasOverlap).toBe(true);

    // Verify no more messages
    const emptyResult = await mq.dequeue(async () => {}, { stream: undefined });
    expect(emptyResult).toBe(false);
  });

  it("should maintain message order within streams when processing multiple streams concurrently", async () => {
    // Enqueue interleaved messages from different streams
    await mq.enqueue([
      { name: "multi", stream: "stream-1", data: { value: "1-1" } },
      { name: "multi", stream: "stream-2", data: { value: "2-1" } },
      { name: "multi", stream: "stream-1", data: { value: "1-2" } },
      { name: "multi", stream: "stream-2", data: { value: "2-2" } },
      { name: "multi", stream: "stream-1", data: { value: "1-3" } },
      { name: "multi", stream: "stream-2", data: { value: "2-3" } },
      { name: "multi", stream: "stream-3", data: { value: "3-1" } },
      { name: "multi", stream: "stream-1", data: { value: "1-4" } },
      { name: "multi", stream: "stream-3", data: { value: "3-2" } },
      { name: "multi", stream: "stream-2", data: { value: "2-4" } }
    ]);

    const processedByStream: Record<string, string[]> = {
      "stream-1": [],
      "stream-2": [],
      "stream-3": []
    };

    // Process all streams concurrently multiple times
    const processingRounds = 4; // Enough rounds to process all messages
    for (let i = 0; i < processingRounds; i++) {
      await Promise.all([
        mq.dequeue(
          async (message) => {
            await sleep(Math.random() * 50); // Random processing time
            const stream = message.stream || "";
            processedByStream[stream].push(message.data.value as string);
          },
          { stream: "stream-1" }
        ),
        mq.dequeue(
          async (message) => {
            await sleep(Math.random() * 50); // Random processing time
            const stream = message.stream || "";
            processedByStream[stream].push(message.data.value as string);
          },
          { stream: "stream-2" }
        ),
        mq.dequeue(
          async (message) => {
            await sleep(Math.random() * 50); // Random processing time
            const stream = message.stream || "";
            processedByStream[stream].push(message.data.value as string);
          },
          { stream: "stream-3" }
        )
      ]);
    }

    // Verify order within each stream
    expect(processedByStream["stream-1"]).toEqual(["1-1", "1-2", "1-3", "1-4"]);
    expect(processedByStream["stream-2"]).toEqual(["2-1", "2-2", "2-3", "2-4"]);
    expect(processedByStream["stream-3"]).toEqual(["3-1", "3-2"]);

    // Verify no more messages in any stream
    const results = await Promise.all([
      mq.dequeue(async () => {}, { stream: "stream-1" }),
      mq.dequeue(async () => {}, { stream: "stream-2" }),
      mq.dequeue(async () => {}, { stream: "stream-3" })
    ]);
    expect(results.every((r) => r === false)).toBe(true);
  });

  it("should correctly handle a mix of streamed and unstreamed messages", async () => {
    // Enqueue mix of streamed and unstreamed messages
    await mq.enqueue([
      { name: "mixed", stream: "stream-1", data: { value: "1-1" } },
      { name: "mixed", data: { value: "u-1" } },
      { name: "mixed", stream: "stream-2", data: { value: "2-1" } },
      { name: "mixed", data: { value: "u-2" } },
      { name: "mixed", stream: "stream-1", data: { value: "1-2" } },
      { name: "mixed", stream: "stream-2", data: { value: "2-2" } },
      { name: "mixed", data: { value: "u-3" } },
      { name: "mixed", stream: "stream-1", data: { value: "1-3" } },
      { name: "mixed", data: { value: "u-4" } },
      { name: "mixed", stream: "stream-2", data: { value: "2-3" } }
    ]);

    const processedByStream: Record<string, string[]> = {
      "stream-1": [],
      "stream-2": [],
      unstreamed: []
    };

    // Track concurrent processing
    const activeProcessing = new Set<string>();
    let streamProcessingOverlap = false;
    let hadConcurrentUnstreamed = false;

    // Promises to coordinate unstreamed message processing
    let firstUnstreamedStarted = false;
    let firstUnstreamedResolve: (x: unknown) => void;

    const firstUnstreamedProcessing = new Promise((resolve) => {
      firstUnstreamedResolve = resolve;
    });

    // Process streamed and unstreamed messages concurrently
    await Promise.all([
      // First unstreamed processor - start this first
      mq.dequeue(
        async (message) => {
          firstUnstreamedStarted = true;
          activeProcessing.add("unstreamed");
          processedByStream["unstreamed"].push(message.data.value as string);
          await sleep(100); // Longer sleep to ensure overlap opportunity
          firstUnstreamedResolve(undefined);
          activeProcessing.delete("unstreamed");
        },
        { stream: undefined }
      ),

      // Wait briefly to ensure first unstreamed has started
      (async () => {
        await sleep(50);
        return mq.dequeue(
          async (message) => {
            if (firstUnstreamedStarted && activeProcessing.has("unstreamed")) {
              hadConcurrentUnstreamed = true;
            }
            activeProcessing.add("unstreamed");
            processedByStream["unstreamed"].push(message.data.value as string);
            await sleep(10);
            activeProcessing.delete("unstreamed");
          },
          { stream: undefined }
        );
      })(),

      // Stream processors can start whenever
      mq.dequeue(
        async (message) => {
          const stream = "stream-1";
          if (activeProcessing.has(stream)) streamProcessingOverlap = true;
          activeProcessing.add(stream);
          await sleep(10);
          activeProcessing.delete(stream);
          processedByStream[stream].push(message.data.value as string);
        },
        { stream: "stream-1" }
      ),

      mq.dequeue(
        async (message) => {
          const stream = "stream-2";
          if (activeProcessing.has(stream)) streamProcessingOverlap = true;
          activeProcessing.add(stream);
          await sleep(10);
          activeProcessing.delete(stream);
          processedByStream[stream].push(message.data.value as string);
        },
        { stream: "stream-2" }
      )
    ]);

    // Wait for first unstreamed to complete
    await firstUnstreamedProcessing;

    // Process remaining messages
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const streamResults = await Promise.all([
        mq.dequeue(
          async (message) => {
            const stream = "stream-1";
            if (activeProcessing.has(stream)) streamProcessingOverlap = true;
            activeProcessing.add(stream);
            await sleep(10);
            activeProcessing.delete(stream);
            processedByStream[stream].push(message.data.value as string);
          },
          { stream: "stream-1" }
        ),
        mq.dequeue(
          async (message) => {
            const stream = "stream-2";
            if (activeProcessing.has(stream)) streamProcessingOverlap = true;
            activeProcessing.add(stream);
            await sleep(10);
            activeProcessing.delete(stream);
            processedByStream[stream].push(message.data.value as string);
          },
          { stream: "stream-2" }
        ),
        mq.dequeue(
          async (message) => {
            if (activeProcessing.has("unstreamed")) {
              hadConcurrentUnstreamed = true;
            }
            activeProcessing.add("unstreamed");
            processedByStream["unstreamed"].push(message.data.value as string);
            await sleep(10);
            activeProcessing.delete("unstreamed");
          },
          { stream: undefined }
        )
      ]);

      if (streamResults.every((r) => r === false)) break;
    }

    // Verify order within streamed messages
    expect(processedByStream["stream-1"]).toEqual(["1-1", "1-2", "1-3"]);
    expect(processedByStream["stream-2"]).toEqual(["2-1", "2-2", "2-3"]);

    // Verify all unstreamed messages were processed
    expect(processedByStream["unstreamed"].length).toBe(4);
    expect(new Set(processedByStream["unstreamed"])).toEqual(
      new Set(["u-1", "u-2", "u-3", "u-4"])
    );

    // Verify concurrent processing of unstreamed messages occurred
    expect(hadConcurrentUnstreamed).toBe(true);

    // Verify no concurrent processing within streams
    expect(streamProcessingOverlap).toBe(false);
  });
});
