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
      action: () => {
        //console.log("test1", 1);
        return Promise.resolve(true);
      },
      delay: 3000
    });
    expect(schedule.pending()).toBe(1);

    schedule.push({
      id: "test1",
      action: () => {
        //console.log("test1", 2);
        return Promise.resolve(true);
      },
      delay: 3000
    });
    expect(schedule.pending()).toBe(1);

    schedule.push({
      id: "test2",
      action: () => {
        //console.log("test2");
        return Promise.resolve(true);
      },
      delay: 10,
      callback: callback1
    });
    schedule.push({
      id: "test3",
      action: () => {
        //console.log("test3");
        return Promise.resolve(true);
      },
      delay: 10
    });
    await sleep(100);
    expect(callback1).toHaveBeenCalled();

    schedule.push({
      id: "test4",
      action: () => {
        //console.log("test4");
        return Promise.resolve(true);
      },
      delay: 2000,
      callback: callback2
    });
    schedule.push({
      id: "test5",
      action: async () => {
        //console.log("starting test5");
        await sleep(1000);
        return true;
      }
    });
    await sleep(100);
    expect(schedule.status()).toBe("running");

    await schedule.stop();
    expect(schedule.status()).toBe("stopped");
    expect(callback2).toHaveBeenCalledTimes(0);
  });
});
