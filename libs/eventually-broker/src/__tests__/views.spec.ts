import axios from "axios";
import { dispose } from "@rotorsoft/eventually";
import { broker } from "../index";
import { subscriptions } from "..";
import { Service, Subscription } from "../types";

const port = 3001;

const serviceBody = (id: string): Service => ({
  id,
  channel: "pg://channel",
  url: "http://url"
});

const subscriptionBody = (id: string): Subscription => ({
  id,
  producer: "s1",
  consumer: "s1",
  path: "path",
  active: false,
  streams: ".*",
  names: ".*",
  position: -1
});

const get = (path: string): Promise<any> => {
  const url = `http://localhost:${port}${path}`;
  try {
    return axios.get<any>(url);
  } catch (error) {
    console.log(error);
    return Promise.resolve({ status: 500 });
  }
};

const post = (path: string, body: any): Promise<any> => {
  const url = `http://localhost:${port}${path}`;
  try {
    return axios.post<any>(url, body);
  } catch (error) {
    console.log(error);
    return Promise.resolve({ status: 500 });
  }
};

const _delete = (path: string): Promise<any> => {
  const url = `http://localhost:${port}${path}`;
  try {
    return axios.delete<any>(url);
  } catch (error) {
    console.log(error);
    return Promise.resolve({ status: 500 });
  }
};

describe("views", () => {
  beforeAll(async () => {
    await broker({ port });
    await subscriptions().createService(serviceBody("s1"));
    await subscriptions().createSubscription(subscriptionBody("s1"));
    await subscriptions().createService(serviceBody("s3"));
    await subscriptions().createSubscription(subscriptionBody("s3"));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(() => {
    dispose()();
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
      "/_toggle/s1",
      "/_refresh/s1"
    ];
    const responses = await Promise.all(paths.map((path) => get(path)));
    responses.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should post", async () => {
    const responses1 = await Promise.all(
      ["/_add", "/s2"].map((path) => post(path, subscriptionBody("s2")))
    );
    responses1.map((response) => {
      expect(response.status).toBe(200);
    });

    const responses2 = await Promise.all(
      ["/_services/_add", "/_services/s2"].map((path) =>
        post(path, serviceBody("s2"))
      )
    );
    responses2.map((response) => {
      expect(response.status).toBe(200);
    });

    const responses3 = await Promise.all([
      post("/", { search: "s2" }),
      post("/", {})
    ]);
    responses3.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should post with validation errors", async () => {
    const responses1 = await Promise.all(
      ["/_add", "/s2"].map((path) => post(path, { invalid: true }))
    );
    responses1.map((response) => {
      expect(response.status).toBe(200);
    });
    const responses2 = await Promise.all(
      ["/_services/_add", "/_services/s2"].map((path) =>
        post(path, { invalid: true })
      )
    );
    responses2.map((response) => {
      expect(response.status).toBe(200);
    });
  });

  it("should delete", async () => {
    const paths = ["/s3", "/_services/s3"];
    const responses = await Promise.all(paths.map((path) => _delete(path)));
    responses.map((response) => {
      expect(response.status).toBe(200);
    });
  });
});
