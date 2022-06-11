import { dispose } from "@rotorsoft/eventually";
import cluster from "cluster";
import { pullchannel, subscriptions } from "..";
import { defaultResolvers } from "../broker";
import {
  ChannelConfig,
  sendError,
  sendStats,
  state,
  SubscriptionConfig,
  SubscriptionStats,
  work
} from "../cluster";
import {
  createCommittedEvent,
  FakeChildProcess,
  serviceBody,
  subscriptionBody
} from "./utils";

describe("cluster", () => {
  beforeAll(async () => {
    jest.spyOn(cluster, "fork").mockReturnValue(new FakeChildProcess(1));
    pullchannel().pull = () =>
      Promise.resolve([
        createCommittedEvent(1, "e1", "s1"),
        createCommittedEvent(2, "e2", "s1")
      ]);

    await subscriptions().createService(
      serviceBody("s1", "void://", "void://")
    );
    await subscriptions().createSubscription(
      subscriptionBody("s1", "s1", "s1", true)
    );
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await dispose()();
  });

  it("should view model", async () => {
    const config = {
      id: "s1",
      active: true,
      endpoint: "void://",
      streams: ".*",
      names: ".*",
      position: 2,
      batchSize: 100,
      retries: 3,
      retryTimeoutSecs: 10
    };
    const stats: SubscriptionStats = {
      batches: 1,
      total: 5,
      events: {
        event1: { "200": { count: 1, min: 1, max: 1 } },
        event2: {
          "200": { count: 1, min: 2, max: 2 },
          "204": { count: 1, min: 3, max: 3 }
        },
        event3: {
          "404": { count: 1, min: 4, max: 4 },
          "503": { count: 1, min: 5, max: 5 }
        }
      }
    };
    sendError("Error message", -1, config);
    sendStats(config, stats);
    await state().refreshSubscription("DELETE", "s1");
    await state().refreshSubscription("INSERT", "s1");
    await state().refreshSubscription("UPDATE", "s1");
    await state().refreshService("DELETE", "s1");
    await state().refreshService("INSERT", "s1");
    await state().refreshService("UPDATE", "s1");
    state().onMessage(1, {
      error: { message: "Error message", position: -1, config }
    });
    state().onMessage(1, {
      trigger: { id: "s1", operation: "RESTART", position: 1 }
    });
    state().onMessage(1, { stats: { ...config, ...stats } });
    const viewModel = state().viewModel("s1");
    expect(viewModel.id).toBe("s1");
    state().onExit(1, 1, "");
  });

  it("should work", async () => {
    const subConfig: SubscriptionConfig = {
      id: "s1",
      active: true,
      endpoint: "void://",
      streams: ".*",
      names: ".*",
      position: 2,
      batchSize: 100,
      retries: 3,
      retryTimeoutSecs: 10
    };
    const chanConfig: ChannelConfig = {
      id: "s1",
      channel: "void://",
      subscriptions: [subConfig],
      runs: 0
    };
    process.env.WORKER_ENV = JSON.stringify(chanConfig);
    await work(defaultResolvers);
    expect(1).toBe(1);
  });
});
