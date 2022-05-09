import { dispose, store } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import axios from "axios";
import { pullchannel, Service, subscriptions } from "..";
import {
  PostgresPullChannel,
  HttpPostPushChannel,
  VoidPullChannel,
  VoidPushChannel
} from "../channels";
import { CronPullChannel } from "../channels/CronPullChannel";
import { createCommittedEvent } from "./utils";

const cronChannel: Service = { 
  id: 'test-cron',
  channel: 'cron://0 0 * * * *',
  url: 'http://test',
  position: -1,
  updated: new Date(),
}

const sub = {
  id: 'test-sub',
  active: true,
  producer: 'test-cron',
  consumer: "http://test",
  names: '.*',
  position: -1,
  updated: new Date(),
  path: '.*',
  streams: '.*'
}

const startMockFn = jest.fn();

jest.mock('cron', () => {
  class MockCronJob {
    stop = jest.fn();
    start = startMockFn;
  }
  return {
    CronJob: MockCronJob
  }
})
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
    channel.init();
    const response = await channel.push(createCommittedEvent());
    expect(response.status).toBe(200);
  });

  it("should pg pull", async () => {
    const table = "pull_test";
    store(PostgresStore(table));
    pullchannel(PostgresPullChannel(new URL(`pg://${table}`)));
    const events = await pullchannel().pull(-1, 1);
    expect(events.length).toBe(0);
  });

  it("should void pull", async () => {
    const channel = VoidPullChannel();
    const events = await channel.pull(-1, 1);
    expect(events.length).toBe(0);
  });

  it("should void push", async () => {
    const channel = VoidPushChannel();
    channel.init();
    const response = await channel.push(createCommittedEvent());
    expect(response.status).toBe(204);
  });

  it('should restart cron with cron expression if next run is greater than now', async () => {
    const today = new Date();
    cronChannel.updated = new Date(today.getTime() + 5*60*60*1000);
    jest.spyOn(subscriptions(), "loadServices").mockResolvedValue([cronChannel]);
    const callbackMockFn = jest.fn();
    const cronExp = encodeURI('cron://0 0 * * * *');
    const channel = CronPullChannel(new URL(cronExp), 'test-cron');
    await channel.listen(callbackMockFn)
    expect(startMockFn).toHaveBeenCalled();
  })

  it('should restart and run cron if next run is less than now', async () => {
    const today = new Date();
    cronChannel.updated = new Date(today.getTime() - 5*60*60*1000);
    const callbackMockFn = jest.fn();
    const cronExp = encodeURI('cron://0 0 * * * *');
    const channel = CronPullChannel(new URL(cronExp), 'test-cron');
    await channel.listen(callbackMockFn)
    expect(callbackMockFn).toHaveBeenCalledWith({ id: cronChannel.id, operation: "RESTART", position: cronChannel.position + 1});
  })

  it('should cron pull', async () => {
    const today = new Date();
    cronChannel.updated = new Date(today.getTime() - 5*60*60*1000);
    jest.spyOn(subscriptions(), "loadSubscriptionsByProducer").mockResolvedValue([sub]);
    const cronExp = encodeURI('cron://0 0 * * * *');
    const channel = CronPullChannel(new URL(cronExp), 'test-cron');
    const events = await channel.pull(-1, 2);
    expect(events.length).toBe(1);
  })
});
