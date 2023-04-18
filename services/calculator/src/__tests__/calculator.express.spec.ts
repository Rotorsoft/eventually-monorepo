import {
  Calculator,
  ExternalPayload,
  PressKeyAdapter,
  StatelessCounter
} from "@rotorsoft/calculator-artifacts";
import {
  app,
  broker,
  dispose,
  InMemorySnapshotStore,
  Scope
} from "@rotorsoft/eventually";
import {
  ExpressApp,
  GcpGatewayMiddleware,
  HttpClient
} from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import { pressKey, reset } from "./messages";

const chance = new Chance();
const port = 4000;
const http = HttpClient(port, {
  "X-Apigateway-Api-Userinfo":
    "eyJzdWIiOiJhY3Rvci1uYW1lIiwicm9sZXMiOlsiYWRtaW4iXSwiZW1haWwiOiJhY3RvckBlbWFpbC5jb20ifQ=="
});

const expressApp = new ExpressApp();
app(expressApp)
  .with(Calculator, { store: InMemorySnapshotStore(4), scope: Scope.public })
  .with(StatelessCounter)
  .with(PressKeyAdapter)
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
      result: 3.3
    });

    const calc_snapshots = await http.stream(Calculator, id);
    expect(calc_snapshots.length).toEqual(6);
  });

  it("should reset on last key pressed", async () => {
    const id = chance.guid();

    await reset(http, id);
    await pressKey(http, id, "+");
    await pressKey(http, id, "1");
    await pressKey(http, id, "1");
    await pressKey(http, id, "2");
    await pressKey(http, id, ".");
    await pressKey(http, id, "3");
    await broker().drain();

    const { state } = await http.load(Calculator, id);
    expect(state).toEqual({ result: 0 });
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
      result: -1
    });
    expect(event?.metadata?.causation?.command?.actor).toEqual({
      id: "actor-name",
      name: "actor@email.com",
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
    const stream = chance.guid();

    await pressKey(http, stream, "1");
    await expect(
      http.command(
        Calculator,
        "PressKey",
        { key: "1" },
        { stream, expectedVersion: -1 }
      )
    ).rejects.toThrow("Request failed with status code 409");
  });

  it("should throw validation error", async () => {
    await expect(
      http.command(Calculator, "PressKey", {}, { stream: chance.guid() })
    ).rejects.toThrow("Request failed with status code 400");
  });

  it("should throw 404 error", async () => {
    await expect(http.get("/calculato")).rejects.toThrow(
      "Request failed with status code 404"
    );
  });

  it("should throw model invariant violation", async () => {
    await expect(pressKey(http, chance.guid(), "=")).rejects.toThrow(
      "Request failed with status code 500"
    );
  });
});
