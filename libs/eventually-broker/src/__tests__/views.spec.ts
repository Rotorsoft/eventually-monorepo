import { events } from "./events";
import * as queries from "../queries";
import { dispose } from "@rotorsoft/eventually";
import cluster from "cluster";
import { subscriptions } from "..";
import { broker } from "../broker";
import { InMemorySubscriptionStore } from "../__dev__";
import {
  FakeChildProcess,
  get,
  post,
  serviceBody,
  subscriptionBody,
  _delete
} from "./utils";
import { state } from "../cluster";

const port = 3001;
jest.spyOn(queries, "getServiceStream").mockResolvedValue(events);

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
    await broker({ subscriptionStoreFactory: InMemorySubscriptionStore, port });
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

  it("should get 2", async () => {
    const paths = [
      "/_graph",
      "/_contracts",
      "/_contracts/all",
      "/_contracts/all?names=b",
      "/_contracts/all?services=a&names=b",
      "/_contracts/events",
      "/_correlation/aZCNKNr3HP5pQRWIxvj3XeoZ"
    ];
    const responses = await Promise.all(paths.map((path) => get(path, port)));
    responses.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should get queries", async () => {
    const paths = [
      "/_services/s1/events",
      "/_services/s1/events/1",
      "/_services/s1/stream/calculator"
    ];
    const events = await queries.getServiceStream(state().services()[0], {});
    expect(events?.length).toBeGreaterThan(1);

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

    const responses2 = await Promise.all([
      post("/", { search: "s2" }, port),
      post("/", {}, port)
    ]);
    responses2.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should add-update service", async () => {
    const response1 = await post("/_services/_add", serviceBody("s2"), port);
    expect(response1.status).toBe(200);

    const response2 = await post("/_services/s2", serviceBody("s2"), port);
    expect(response2.status).toBe(200);
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
});
