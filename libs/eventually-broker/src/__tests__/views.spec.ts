import { events } from "./events";
import * as queries from "../queries";
import { CommittedEvent, dispose } from "@rotorsoft/eventually";
import cluster from "cluster";
import { subscriptions } from "..";
import { broker } from "../broker";
import { InMemorySubscriptionStore } from "../adapters";
import {
  FakeChildProcess,
  get,
  post,
  serviceBody,
  stream,
  subscriptionBody,
  _delete
} from "./utils";
import { state } from "../cluster";

const port = 3001;
jest
  .spyOn(queries, "getServiceStream")
  .mockResolvedValue(events as CommittedEvent[]);

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
    await broker({
      subscriptionStoreFactory: InMemorySubscriptionStore,
      port,
      handlers: [
        (_, __, next) => {
          next();
        }
      ],
      middleware: [
        (_, __, next) => {
          next();
        }
      ],
      serviceLogLinkTemplate: "http://localhost",
      secrets: {
        byService: {},
        bySubscription: {}
      }
    });
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await dispose()();
  });

  it("should get", async () => {
    const paths = [
      "/subscriptions",
      "/subscriptions&add=true",
      "/subscriptions&search=s1",
      "/subscriptions/s1",
      "/services",
      "/services&add=true",
      "/services&search=s1",
      "/services/s1",
      "/command/wait/s1",
      "/command/refresh/s1",
      "/command/toggle/s1",
      "/graph",
      "/contracts",
      "/api/events",
      "/correlations/aZCNKNr3HP5pQRWIxvj3XeoZ",
      "/about"
    ];
    const responses = await Promise.all(paths.map((path) => get(path, port)));
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should monitor", async () => {
    const paths = ["/monitor", "/monitor/123"];
    const responses = await Promise.all(
      paths.map((path) => stream(path, port))
    );
    responses.forEach((response) => {
      expect(response).toBeDefined();
    });
  });

  it("should get queries", async () => {
    const paths = [
      "/services/s1/events",
      "/services/s1/events/1",
      "/services/s1/stream/calculator"
    ];
    const events = await queries.getServiceStream(state().services()[0], {});
    expect(events?.length).toBeGreaterThan(1);

    const responses = await Promise.all(paths.map((path) => get(path, port)));
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should post", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { active, position, ...rest } = subscriptionBody("s2");
    const response1 = await post("/subscriptions/s2", { ...rest }, port);
    expect(response1.status).toBe(200);
  });

  it("should add-update service", async () => {
    const response1 = await post("/services", serviceBody("s2"), port);
    expect(response1.status).toBe(200);

    const response2 = await post("/services/s2", serviceBody("s2"), port);
    expect(response2.status).toBe(200);
  });

  it("should post with validation errors", async () => {
    const response1 = await post("/services", { invalid: true }, port);
    expect(response1.status).toBe(200);

    const response2 = await post("/services/s2", { invalid: true }, port);
    expect(response2.status).toBe(200);
  });

  it("should delete", async () => {
    const paths = ["/subscriptions/s3", "/services/s3"];
    const responses = await Promise.all(
      paths.map((path) => _delete(path, port))
    );
    responses.map((response) => {
      expect(response.status).toBe(200);
    });
  });
});
