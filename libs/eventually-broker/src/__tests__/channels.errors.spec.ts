import axios from "axios";
import { HttpPostPushChannel } from "../channels";
import { PushEvent } from "../types";
import { createCommittedEvent } from "./utils";

describe("channels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail post push", async () => {
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    await channel.init();
    const events = [createCommittedEvent()] as PushEvent[];
    const code = await channel.push(events);
    expect(code).toBe(503);
  });

  it("should fail post push 2", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    await channel.init();
    const events = [createCommittedEvent()] as PushEvent[];
    const code = await channel.push(events);
    expect(code).toBe(503);
  });

  it("should fail post push 3", async () => {
    jest.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 400, statusText: "Error" }
    });
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    await channel.init();
    const events = [createCommittedEvent()] as PushEvent[];
    const code = await channel.push(events);
    expect(code).toBe(400);
  });

  it("should fail post push 4", async () => {
    jest.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 400, statusText: "Error" }
    });
    jest.spyOn(axios, "isAxiosError").mockReturnValue(false);
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    await channel.init();
    const events = [createCommittedEvent()] as PushEvent[];
    const code = await channel.push(events);
    expect(code).toBe(503);
  });
});
