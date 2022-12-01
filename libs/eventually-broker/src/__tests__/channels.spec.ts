import { CommittedEvent, dispose, store } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import axios from "axios";
import { pullchannel, PushEvent } from "..";
import {
  PostgresPullChannel,
  HttpPostPushChannel,
  VoidPullChannel,
  VoidPushChannel
} from "../channels";
import { CronPullChannel } from "../channels/CronPullChannel";
import { createCommittedEvent } from "./utils";

jest.spyOn(axios, "post").mockResolvedValue({ status: 200, statusText: "OK" });

describe("channels", () => {
  beforeAll(async () => {
    await store().seed();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await dispose()();
  });

  it("should post push", async () => {
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    await channel.init();
    const events = [createCommittedEvent()] as PushEvent[];
    const code = await channel.push(events);
    expect(code).toBe(200);
  });

  it("should pg pull", async () => {
    const table = "pull_test";
    store(PostgresStore(table));
    pullchannel(PostgresPullChannel(new URL(`pg://${table}`)));
    const events = await pullchannel().pull({
      operation: "RESTART",
      position: -1,
      limit: 1
    });
    expect(events.length).toBe(0);
  });

  it("should void pull", async () => {
    const channel = VoidPullChannel();
    const events = await channel.pull({
      operation: "RESTART",
      position: -1,
      limit: 1
    });
    expect(events.length).toBe(0);
  });

  it("should void push", async () => {
    const channel = VoidPushChannel();
    await channel.init();
    const events = [createCommittedEvent()] as PushEvent[];
    const code = await channel.push(events);
    expect(code).toBe(204);
  });

  it("should cron pull", async () => {
    const cronExp = encodeURI("cron://* * * * * *");
    const channel = CronPullChannel(new URL(cronExp), "test-cron");
    const events: CommittedEvent[] = [];
    await channel.listen(async (trigger) => {
      const pulled = await channel.pull({
        operation: "RESTART",
        position: trigger.position || 0,
        limit: 1
      });
      pulled.forEach((e) => {
        events.push(e);
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await channel.dispose();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].name).toBe("TestCron");
  });

  it("should not cron pull", async () => {
    const cronExp = encodeURI("cron://5 0 * * * *");
    const channel = CronPullChannel(new URL(cronExp), "test-cron");
    const events: CommittedEvent[] = [];
    await channel.listen(async (trigger) => {
      const pulled = await channel.pull({
        operation: "RESTART",
        position: trigger.position || 0,
        limit: 1
      });
      pulled.forEach((e) => {
        events.push(e);
      });
    });
    await channel.pull({
      operation: "RESTART",
      position: 0,
      limit: 1
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await channel.dispose();
    expect(events.length).toBe(0);
  });

  it("should manual cron pull", async () => {
    const cronExp = encodeURI("cron://5 0 * * * *");
    const channel = CronPullChannel(new URL(cronExp), "test-cron");
    await channel.listen(jest.fn());
    const events = await channel.pull({
      operation: "MANUAL",
      position: 0,
      limit: 1
    });
    await channel.dispose();
    expect(events.length).toBe(1);
  });
});
