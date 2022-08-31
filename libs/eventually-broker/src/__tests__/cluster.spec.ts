import { dispose } from "@rotorsoft/eventually";
import axios from "axios";
import cluster from "cluster";
import {
  pullchannel,
  PushChannel,
  Subscription,
  subscriptions,
  VoidPushChannel
} from "..";
import { defaultResolvers } from "../broker";
import {
  WorkerConfig,
  state,
  SubscriptionState,
  toViewModel,
  work
} from "../cluster";
import { InMemorySubscriptionStore } from "../__dev__";
import {
  createCommittedEvent,
  FakeChildProcess,
  serviceBody,
  subscriptionBody
} from "./utils";

const TestPushChannel = (): PushChannel => ({
  label: "",
  init: () => Promise.resolve(undefined),
  push: (events): Promise<number> => {
    events.map((event) => {
      if (event.name === "e1")
        event.response = {
          statusCode: 204,
          statusText: "VOID"
        };
      else if (event.name === "e2")
        event.response = {
          statusCode: 200,
          statusText: "OK"
        };
      else if (event.name === "e3")
        event.response = {
          statusCode: 404,
          statusText: "Not Found"
        };
      else
        event.response = {
          statusCode: 204,
          statusText: "VOID"
        };
    });
    return Promise.resolve(
      events[events.length - 1].response?.statusCode || 200
    );
  }
});

const endpoints = {
  commandHandlers: {},
  eventHandlers: {}
};

describe("cluster", () => {
  beforeAll(async () => {
    jest.spyOn(cluster, "fork").mockReturnValue(new FakeChildProcess(1));
    jest
      .spyOn(axios, "get")
      .mockResolvedValue({ status: 200, statusText: "OK", data: endpoints });
    pullchannel().pull = () =>
      Promise.resolve([
        createCommittedEvent(1, "e1", "s1"),
        createCommittedEvent(2, "e2", "s1"),
        createCommittedEvent(3, "e3", "s1")
      ]);

    await subscriptions().createService(
      serviceBody("s1", "void://", "http://test")
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
      producer: "s1",
      consumer: "s2",
      path: "/",
      endpoint: "http://",
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
      pushChannel: VoidPushChannel(),
      streamsRegExp: new RegExp(""),
      namesRegExp: new RegExp(""),
      endpointStatus: {
        code: undefined,
        color: "success",
        name: undefined,
        icon: "bi-activity"
      }
    };
    await state().init(await subscriptions().loadServices(), {
      resolvers: defaultResolvers
    });
    state().refreshSubscription("DELETE", "s1");
    state().refreshSubscription("INSERT", "s1");
    state().refreshSubscription("UPDATE", "s1");
    state().refreshService("DELETE", "s1");
    state().refreshService("INSERT", "s1");
    state().refreshService("UPDATE", "s1");
    state().refreshSubscription("INSERT", "s1");

    state().onMessage(1, {
      error: { message: "Error message" }
    });
    state().onMessage(1, {
      trigger: { id: "s1", operation: "RESTART", position: 1 }
    });
    state().onMessage(1, { state: subState });

    const viewModel = state().viewModel(
      (await subscriptions().loadSubscriptions("s1"))[0]
    );
    expect(viewModel.id).toBe("s1");
    state().onExit(1, 1, "");
    const services = state().services();
    toViewModel(subState, services[0], services[0]);
  });

  it("should work", async () => {
    const subConfig: Subscription = {
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
    const chanConfig: WorkerConfig = {
      id: "s1",
      workerId: -1,
      channel: "void://",
      subscriptions: { s1: subConfig },
      runs: 0
    };
    process.env.WORKER_ENV = JSON.stringify(chanConfig);
    await work({
      subscriptionStoreFactory: () => InMemorySubscriptionStore(),
      resolvers: {
        ...defaultResolvers,
        ...{ push: { "test:": () => TestPushChannel() } }
      }
    });
    // await for pump to finish async
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(1).toBe(1);
  });
});
