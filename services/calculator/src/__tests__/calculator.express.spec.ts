import {
  Calculator,
  ExternalPayload,
  PressKeyAdapter,
  StatelessCounter
} from "@rotorsoft/calculator-artifacts";
import { app, dispose, InMemorySnapshotStore } from "@rotorsoft/eventually";
import {
  ExpressApp,
  GcpGatewayMiddleware,
  HttpClient
} from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import { pressKey } from "./messages";

const chance = new Chance();
const port = 4000;
const http = HttpClient(port, {
  "X-Apigateway-Api-Userinfo":
    "eyJzdWIiOiJhY3Rvci1uYW1lIiwicm9sZXMiOlsiYWRtaW4iXSwiZW1haWwiOiJhY3RvckBlbWFpbC5jb20ifQ=="
});

const expressApp = new ExpressApp();
app(expressApp)
  .with(Calculator)
  .with(StatelessCounter)
  .with(PressKeyAdapter)
  .withSnapshot(Calculator, {
    store: InMemorySnapshotStore(),
    threshold: 2,
    expose: true
  })
  .build([GcpGatewayMiddleware]);

describe("calculator express app", () => {
  beforeAll(async () => {
    await expressApp.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should compute correctly", async () => {
    const id = chance.guid();

    await pressKey(http, id, "1");
    await pressKey(http, id, "+");
    await pressKey(http, id, "2");
    await pressKey(http, id, ".");
    await pressKey(http, id, "3");

    await http.invoke(PressKeyAdapter, { id, key: "=" } as ExternalPayload);

    const { state } = await http.load(Calculator, id);
    expect(state).toEqual({
      left: "3.3",
      operator: "+",
      result: 3.3
    });

    const calc_snapshots = await http.stream(Calculator, id);
    expect(calc_snapshots.length).toEqual(6);
  });

  it("should compute correctly and read stream with and without snapshots", async () => {
    const id = chance.guid();

    await pressKey(http, id, "+");
    await pressKey(http, id, "1");
    await pressKey(http, id, "-");
    await pressKey(http, id, "2");
    await pressKey(http, id, "*");
    await pressKey(http, id, "3");
    await pressKey(http, id, "/");
    await pressKey(http, id, "3");
    await pressKey(http, id, "=");

    const { state, event } = await http.load(Calculator, id);
    expect(state).toEqual({
      left: "-1",
      operator: "/",
      result: -1
    });
    expect(event?.metadata?.causation?.command?.actor).toEqual({
      name: "actor-name",
      roles: ["admin"]
    });

    const snapshots1 = await http.stream(Calculator, id);
    expect(snapshots1.length).toBe(9);

    const snapshots2 = await http.stream(Calculator, id, {
      useSnapshots: true
    });
    expect(snapshots2.length).toBe(1);
  });

  it("should not load events", async () => {
    const { event } = await http.load(Calculator, chance.guid());
    expect(event).toBeUndefined();
  });

  it("should not load stream", async () => {
    const snapshots = await http.stream(Calculator, chance.guid());
    expect(snapshots.length).toBe(0);
  });

  it("should throw concurrency error", async () => {
    const id = chance.guid();

    await pressKey(http, id, "1");
    await expect(
      http.command(
        Calculator,
        "PressKey",
        { key: "1" },
        { id, expectedVersion: -1 }
      )
    ).rejects.toThrowError("Request failed with status code 409");
  });

  it("should throw validation error", async () => {
    await expect(
      http.command(Calculator, "PressKey", {}, { id: chance.guid() })
    ).rejects.toThrowError("Request failed with status code 400");
  });

  it("should throw 404 error", async () => {
    await expect(http.get("/calculato")).rejects.toThrowError(
      "Request failed with status code 404"
    );
  });

  it("should throw model invariant violation", async () => {
    await expect(pressKey(http, chance.guid(), "=")).rejects.toThrowError(
      "Request failed with status code 500"
    );
  });
});
