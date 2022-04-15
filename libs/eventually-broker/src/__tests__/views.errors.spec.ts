import { dispose } from "@rotorsoft/eventually";
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

describe("views", () => {
  beforeAll(async () => {
    jest.spyOn(cluster, "fork").mockReturnValue(new FakeChildProcess(2));

    store.createService = undefined;
    store.updateService = undefined;
    store.deleteService = undefined;
    store.createSubscription = undefined;
    store.updateSubscription = undefined;
    store.deleteSubscription = undefined;
    store.toggleSubscription = undefined;
    store.commitSubscriptionPosition = undefined;
    store.commitServicePosition = undefined;
    subscriptions(store);
    await broker({ port });
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should throw oops when adding subscription", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { active, position, ...rest } = subscriptionBody("s8");
    const response = await post("/_add", { ...rest }, port);
    expect(response.status).toBe(200);
  });

  it("should throw oops when updating service", async () => {
    const response = await post("/_services/s8", serviceBody("s8"), port);
    expect(response.status).toBe(200);
  });

  it("should throw oops when updating subscription", async () => {
    const response = await post("/s8", subscriptionBody("s8"), port);
    expect(response.status).toBe(200);
  });

  it("should throw oops when adding service", async () => {
    const response = await post("/_services/_add", serviceBody("s8"), port);
    expect(response.status).toBe(200);
  });

  it("should pass when deleting subscription", async () => {
    const response = await _delete("/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when deleting service", async () => {
    const response = await _delete("/_services/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when loading service - throw", async () => {
    store.loadServices = jest.fn().mockImplementation(() => {
      throw Error();
    });
    const response = await get("/_services/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when loading service - not found", async () => {
    store.loadServices = jest.fn().mockImplementation(() => []);
    const response = await get("/_services/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when toggle throws", async () => {
    store.toggleSubscription = undefined;
    const response = await get("/_toggle/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when refresh throws", async () => {
    state().refreshSubscription = undefined;
    const response = await get("/_refresh/s8", port);
    expect(response.status).toBe(200);
  });

  it("should pass when load throws", async () => {
    store.loadSubscriptions = undefined;
    const response = await get("/s8", port);
    expect(response.status).toBe(200);
  });
});
