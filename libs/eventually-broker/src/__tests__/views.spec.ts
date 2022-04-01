import { dispose } from "@rotorsoft/eventually";
import cluster from "cluster";
import { subscriptions } from "..";
import { broker, defaultResolvers } from "../broker";
import {
  ChannelConfig,
  sendError,
  sendStats,
  state,
  SubscriptionStats,
  work
} from "../cluster";
import {
  FakeChildProcess,
  get,
  post,
  serviceBody,
  subscriptionBody,
  _delete
} from "./utils";

const port = 3001;

describe("views", () => {
  beforeAll(async () => {
    jest.spyOn(cluster, "fork").mockReturnValue(new FakeChildProcess(1));

    await subscriptions().createService(serviceBody("s1"));
    await subscriptions().createService(serviceBody("abc"));
    await subscriptions().createService(serviceBody("xyz"));
    await subscriptions().createService(serviceBody("s3", "void://"));
    await subscriptions().createService(
      serviceBody("s4", "void://", "https://localhost")
    );
    await subscriptions().createService(
      serviceBody("s5", "void://", "void://")
    );
    await subscriptions().createSubscription(subscriptionBody("s1"));
    await subscriptions().createSubscription(subscriptionBody("s3"));
    await subscriptions().createSubscription(
      subscriptionBody("s4", "s1", "s4")
    );
    await subscriptions().createSubscription(
      subscriptionBody("s5", "s1", "s5")
    );
    await broker({ port });
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await dispose()();
  });

  it("should get", async () => {
    const paths = [
      "/",
      "/_services",
      "/_add",
      "/_services/_add",
      "/s1",
      "/_services/s1",
      "/_wait/s1",
      "/_refresh/s1",
      "/_toggle/s1"
    ];
    const responses = await Promise.all(paths.map((path) => get(path, port)));
    responses.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should post", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { active, position, ...rest } = subscriptionBody("s2");
    const responses1 = await Promise.all(
      ["/_add", "/s2"].map((path) => post(path, { ...rest }, port))
    );
    responses1.map((response) => {
      expect(response.status).toBe(200);
    });

    const responses2 = await Promise.all(
      ["/_services/_add", "/_services/s2"].map((path) =>
        post(path, serviceBody("s2"), port)
      )
    );
    responses2.map((response) => {
      expect(response.status).toBe(200);
    });

    const responses3 = await Promise.all([
      post("/", { search: "s2" }, port),
      post("/", {}, port)
    ]);
    responses3.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should post with validation errors", async () => {
    const responses1 = await Promise.all(
      ["/_add", "/s2"].map((path) => post(path, { invalid: true }, port))
    );
    responses1.map((response) => {
      expect(response.status).toBe(200);
    });
    const responses2 = await Promise.all(
      ["/_services/_add", "/_services/s2"].map((path) =>
        post(path, { invalid: true }, port)
      )
    );
    responses2.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should delete", async () => {
    const paths = ["/s3", "/_services/s3"];
    const responses = await Promise.all(
      paths.map((path) => _delete(path, port))
    );
    responses.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should view model", () => {
    const config = {
      id: "s1",
      active: true,
      endpoint: "http://localhost",
      streams: ".*",
      names: ".*",
      position: 2
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
    sendError("Error message", config);
    sendStats(config, stats);
    state().onMessage(1, { error: { message: "Error message", config } });
    state().onMessage(1, {
      trigger: { id: "s1", operation: "RESTART", position: 1 }
    });
    state().onMessage(1, { stats: { ...config, ...stats } });
    const viewModel = state().viewModel("s1");
    expect(viewModel.id).toBe("s1");
    state().onExit(1, 1, "");
  });

  it("should work", async () => {
    const config: ChannelConfig = {
      id: "s1",
      channel: "void://",
      position: -1,
      subscriptions: [],
      runs: 0
    };
    process.env.WORKER_ENV = JSON.stringify(config);
    await work(defaultResolvers);
    expect(1).toBe(1);
  });
});
