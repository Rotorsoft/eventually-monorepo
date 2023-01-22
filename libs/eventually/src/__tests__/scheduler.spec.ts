import { scheduler } from "../scheduler";
import { dispose } from "../singleton";
import { sleep } from "../utils";

describe("scheduler", () => {
  const schedule = scheduler("test");

  afterAll(async () => {
    await schedule.dispose();
    await dispose()();
  });

  it("should start and stop", async () => {
    expect(schedule.status()).toBe("stopped");

    const callback1 = jest.fn();
    const callback2 = jest.fn();

    schedule.push({
      id: "test1",
      action: () => Promise.resolve(true),
      delay: 3000
    });
    expect(schedule.pending()).toBe(1);

    schedule.push({
      id: "test1",
      action: () => Promise.resolve(true),
      delay: 3000
    });
    expect(schedule.pending()).toBe(1);

    schedule.push({
      id: "test2",
      action: () => Promise.resolve(true),
      delay: 10,
      callback: callback1
    });
    schedule.push({
      id: "test3",
      action: () => Promise.resolve(true),
      delay: 10
    });
    await sleep(100);
    expect(callback1).toHaveBeenCalled();

    schedule.push({
      id: "test4",
      action: async () => {
        await sleep(3000);
        return true;
      },
      callback: callback2
    });
    await sleep(500);
    expect(schedule.status()).toBe("running");

    await schedule.stop();
    expect(schedule.status()).toBe("stopped");
    expect(callback2).toHaveBeenCalled();
  });
});
