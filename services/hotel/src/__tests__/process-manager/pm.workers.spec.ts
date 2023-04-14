import { dispose, store } from "@rotorsoft/eventually";
import { spawnTs } from "./spawn-ts";
import { PostgresStore } from "@rotorsoft/eventually-pg";

describe("pm workers", () => {
  beforeAll(async () => {
    await store(PostgresStore("pm")).seed();
    await store().reset();
  });

  afterAll(async () => {
    await dispose()();
  });

  /*
    This test spawns 9 child processes, competing for 3 monthly booking limits.
    It should complete all 9 and display the results, some of them should be actor concurrency errors.
    The worker process is not waiting for the internal broker to lease the subscription to the consumer (serialized subscription),
    it's calling the event handler directly to force concurrent commits
  */
  it("should display actor concurrency errors", async () => {
    process.env.TIMEOUT = "200";
    const workers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const results = await Promise.all(
      workers.map(async (w) => spawnTs(`${__dirname}/worker.ts`, w.toString()))
    );
    console.log(results);
    expect(results.length).toBe(workers.length);
  }, 60000);
});
