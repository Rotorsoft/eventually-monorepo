import { dispose } from "@rotorsoft/eventually";
import cluster from "cluster";
import {
  pullchannel,
  PushChannel,
  PushResponse,
  subscriptions,
  VoidPushChannel
} from "..";
import { defaultResolvers } from "../broker";
import {
  ChannelConfig,
  state,
  SubscriptionWithEndpoint,
  SubscriptionState,
  toViewModel,
  work
} from "../cluster";
import {
  createCommittedEvent,
  FakeChildProcess,
  serviceBody,
  subscriptionBody
} from "./utils";

const TestPushChannel = (): PushChannel => ({
  init: () => undefined,
  push: (event): Promise<PushResponse> => {
    if (event.name === "e1")
      return Promise.resolve({ status: 204, statusText: "VOID" });
    if (event.name === "e2")
      return Promise.resolve({ status: 200, statusText: "OK" });
    if (event.name === "e3")
      return Promise.resolve({ status: 404, statusText: "Not Found" });
    return Promise.resolve({ status: 204, statusText: "VOID" });
  }
});

describe("cluster", () => {
  beforeAll(async () => {
    jest.spyOn(cluster, "fork").mockReturnValue(new FakeChildProcess(1));
    pullchannel().pull = () =>
      Promise.resolve([
        createCommittedEvent(1, "e1", "s1"),
        createCommittedEvent(2, "e2", "s1"),
        createCommittedEvent(3, "e3", "s1")
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
    const subState: SubscriptionState = {
      id: "s1",
      active: true,
      endpoint: "void://",
      position: 2,
      batchSize: 100,
      retries: 3,
      retryTimeoutSecs: 10,
      stats: {
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
      },
      pumping: false,
      pushChannel: VoidPushChannel(),
      streamsRegExp: new RegExp(""),
      namesRegExp: new RegExp(""),
      retryTimeout: undefined,
      endpointStatus: {
        code: undefined,
        color: "success",
        name: undefined,
        icon: "bi-activity"
      },
      events: []
    };
    await state().refreshSubscription("DELETE", "s1");
    await state().refreshSubscription("INSERT", "s1");
    await state().refreshSubscription("UPDATE", "s1");
    await state().refreshService("DELETE", "s1");
    await state().refreshService("INSERT", "s1");
    await state().refreshService("UPDATE", "s1");
    state().onMessage(1, {
      error: { message: "Error message" }
    });
    state().onMessage(1, {
      error: { message: "Error message" }
    });
    state().onMessage(1, {
      trigger: { id: "s1", operation: "RESTART", position: 1 }
    });
    state().onMessage(1, { state: subState });
    const viewModel = state().viewModel("s1");
    expect(viewModel.id).toBe("s1");
    state().onExit(1, 1, "");
    toViewModel(subState);
    toViewModel(subState, "good", 1);
  });

  it("should work", async () => {
    const subConfig: SubscriptionWithEndpoint = {
      id: "s1",
      active: true,
      producer: "",
      consumer: "",
      path: "",
      updated: new Date(),
      endpoint: "test://",
      streams: ".*",
      names: ".*",
      position: 2,
      batch_size: 100,
      retries: 3,
      retry_timeout_secs: 10
    };
    const chanConfig: ChannelConfig = {
      id: "s1",
      channel: "void://",
      subscriptions: { s1: subConfig },
      runs: 0,
      status: ""
    };
    process.env.WORKER_ENV = JSON.stringify(chanConfig);
    const subStates = await work({
      ...defaultResolvers,
      ...{ push: { "test:": () => TestPushChannel() } }
    });
    Object.values(subStates).forEach((s) => {
      s.retryTimeout && clearTimeout(s.retryTimeout);
    });
    expect(1).toBe(1);
  });
});
