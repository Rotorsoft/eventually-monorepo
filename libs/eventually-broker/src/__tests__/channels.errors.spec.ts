import axios from "axios";
import { HttpPostPushChannel } from "../channels";
import { createCommittedEvent } from "./utils";

describe("channels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail post push", async () => {
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    channel.init();
    const response = await channel.push(createCommittedEvent());
    expect(response.status).toBe(503);
  });

  it("should fail post push 2", async () => {
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    channel.init();
    const response = await channel.push(createCommittedEvent());
    expect(response.status).toBe(503);
  });

  it("should fail post push 3", async () => {
    jest.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 400, statusText: "Error" }
    });
    jest.spyOn(axios, "isAxiosError").mockReturnValue(true);
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    channel.init();
    const response = await channel.push(createCommittedEvent());
    expect(response.status).toBe(400);
  });

  it("should fail post push 4", async () => {
    jest.spyOn(axios, "post").mockRejectedValueOnce({
      response: { status: 400, statusText: "Error" }
    });
    jest.spyOn(axios, "isAxiosError").mockReturnValue(false);
    const channel = HttpPostPushChannel(new URL("http://localhost"));
    channel.init();
    const response = await channel.push(createCommittedEvent());
    expect(response.status).toBe(503);
  });
});
