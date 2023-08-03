import { dispose } from "@andela-technology/eventually";
import cluster from "cluster";
import { subscriptions } from "..";
import { broker } from "../broker";
import { state } from "../cluster";
import { InMemorySubscriptionStore } from "../__dev__";
import {
  FakeChildProcess,
  get,
  post,
  serviceBody,
  subscriptionBody,
  _delete
} from "./utils";

const port = 3009;
const store = InMemorySubscriptionStore();
const oops = <T>(): T => {
  throw Error();
};

describe("views", () => {
  beforeAll(async () => {
    jest.spyOn(cluster, "fork").mockReturnValue(new FakeChildProcess(2));

    store.createService = oops;
    store.updateService = oops;
    store.deleteService = oops;
    store.createSubscription = oops;
    store.updateSubscription = oops;
    store.deleteSubscription = oops;
    store.toggleSubscription = oops;
    store.commitSubscriptionPosition = oops;
    store.commitServicePosition = oops;
    subscriptions(store);
    await broker({ subscriptionStoreFactory: InMemorySubscriptionStore, port });
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should throw oops when adding subscription", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { active, position, ...rest } = subscriptionBody("s8");
    const response = await post("/", { ...rest }, port);
    expect(response.status).toBe(200);
  });

  it("should throw oops when updating service", async () => {
    const response = await post("/services/s8", serviceBody("s8"), port);
    expect(response.status).toBe(200);
  });

  it("should throw oops when updating subscription", async () => {
    const response = await post("/s8", subscriptionBody("s8"), port);
    expect(response.status).toBe(200);
  });

  it("should throw oops when adding service", async () => {
    const response = await post("/services", serviceBody("s8"), port);
    expect(response.status).toBe(200);
  });

  it("should pass when deleting subscription", async () => {
    const response = await _delete("/subscriptions/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when deleting service", async () => {
    const response = await _delete("/services/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when loading service - throw", async () => {
    store.loadServices = jest.fn().mockImplementation(() => {
      throw Error();
    });
    const response = await get("/services/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when loading service - not found", async () => {
    store.loadServices = jest.fn().mockImplementation(() => []);
    const response = await get("/services/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when toggle throws", async () => {
    store.toggleSubscription = oops;
    const response = await get("/command/toggle/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when refresh throws", async () => {
    state().refreshSubscription = oops;
    const response = await get("/command/refresh/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when load throws", async () => {
    store.loadSubscriptions = oops;
    const response = await get("/subscriptions/s8", port);
    expect(response.status).toBe(200);
  });
});
