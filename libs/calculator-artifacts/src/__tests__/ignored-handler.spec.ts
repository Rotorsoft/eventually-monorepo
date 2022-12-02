import { app, client, dispose } from "@rotorsoft/eventually";
import { IgnoredHandler } from "../counter.policy";
import { createEvent } from "./messages";

// app setup
app().with(IgnoredHandler).build();

describe("ignored handler", () => {
  beforeAll(async () => {
    await app().listen();
  });
  afterAll(async () => {
    await dispose()();
  });

  it("should cover ignored handler", async () => {
    const r1 = await client().event(
      IgnoredHandler,
      createEvent("Ignored1", "ignored", {})
    );
    const r2 = await client().event(
      IgnoredHandler,
      createEvent("Ignored2", "ignored", {})
    );
    expect(r1.command).toBeUndefined();
    expect(r2.state).toBeUndefined();
  });
});
