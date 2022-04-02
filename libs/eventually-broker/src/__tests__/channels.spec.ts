import { dispose, store } from "@rotorsoft/eventually";
import { PostgresStore } from "@rotorsoft/eventually-pg";
import axios from "axios";
import { pullchannel } from "..";
import {
  PostgresPullChannel,
  HttpPostPushChannel,
  VoidPullChannel,
  VoidPushChannel
} from "../channels";
import { createCommittedEvent } from "./utils";

jest.spyOn(axios, "post").mockResolvedValue({ status: 200, statusText: "OK" });

const table = "pull_test";
store(PostgresStore(table));
pullchannel(PostgresPullChannel(new URL(`pg://${table}`)));

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
});
