import {
  app,
  CommittedEvent,
  dispose,
  sleep,
  Snapshot
} from "@rotorsoft/eventually";
import {
  ExpressApp,
  EventResponseEx,
  GcpGatewayMiddleware,
  HttpClient
} from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import {
  Calculator,
  CalculatorEvents,
  CalculatorModel,
  Keys,
  CounterEvents,
  StatelessCounter,
  ExternalPayload,
  PressKeyAdapter
} from "@rotorsoft/calculator-artifacts";
import { InMemorySnapshotStore } from "../../../../libs/eventually/src/__dev__";

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

const pressKey = (
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command(Calculator, "PressKey", { key }, { id });

const reset = (
  id: string
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command(Calculator, "Reset", {}, { id });

describe("express app", () => {
  beforeAll(async () => {
    await expressApp.listen(false, port);
  });

  afterAll(async () => {
    await dispose()();
  });

  describe("Calculator", () => {
    it("should compute correctly", async () => {
      const id = chance.guid();

      await pressKey(id, "1");
      await pressKey(id, "+");
      await pressKey(id, "2");
      await pressKey(id, ".");
      await pressKey(id, "3");

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

    it("should compute correctly 2", async () => {
      const id = chance.guid();

      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "-");
      await pressKey(id, "2");
      await pressKey(id, "*");
      await pressKey(id, "3");
      await pressKey(id, "/");
      await pressKey(id, "3");
      await pressKey(id, "=");

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

      const snapshots = await http.stream(Calculator, id);
      expect(snapshots.length).toBe(9);
    });

    it("should read aggregate stream using snapshots", async () => {
      const id = chance.guid();

      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "-");
      await pressKey(id, "2");
      await pressKey(id, "*");
      await pressKey(id, "3");
      await pressKey(id, "/");
      await pressKey(id, "3");
      await pressKey(id, "=");

      const snapshots = await http.stream(Calculator, id, {
        useSnapshots: true
      });
      expect(snapshots.length).toBe(1);
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

      await pressKey(id, "1");
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
      await expect(pressKey(chance.guid(), "=")).rejects.toThrowError(
        "Request failed with status code 500"
      );
    });
  });

  describe("Counter", () => {
    it("should reset on last key pressed", async () => {
      const id = chance.guid();

      await reset(id);
      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "1");
      await pressKey(id, "2");
      await pressKey(id, ".");
      await pressKey(id, "3");

      const { state } = await http.load(Calculator, id);
      expect(state).toEqual({ result: 0 });
    });

    it("should return no command", async () => {
      const snapshots = await pressKey(chance.guid(), "1");
      const { status, command } = (await http.event(
        StatelessCounter,
        snapshots[0].event as CommittedEvent<CounterEvents>
      )) as EventResponseEx;
      expect(status).toBe(200);
      expect(command).toBeUndefined();
    });

    it("should return no command 2", async () => {
      const snapshots = await pressKey(chance.guid(), ".");
      const response = await http.event(
        StatelessCounter,
        snapshots[0].event as CommittedEvent<CounterEvents>
      );
      expect(response.command).toBeUndefined();
    });

    it("should throw validation error", async () => {
      await expect(
        http.event(StatelessCounter, {
          id: 1,
          stream: chance.guid(),
          version: 1,
          created: new Date(),
          name: "DigitPressed",
          data: {},
          metadata: { correlation: "", causation: {} }
        })
      ).rejects.toThrowError("Request failed with status code 400");
    });

    it("should throw registration error", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        http.event(StatelessCounter, {
          name: "IgnoreThis"
        } as any)
      ).rejects.toThrowError("Request failed with status code 404");
    });
  });

  describe("all stream", () => {
    const id = chance.guid();
    let created_after: Date;
    let created_before: Date;
    let dot_correlation: string;

    beforeAll(async () => {
      await pressKey(id, "1");
      await pressKey(id, "+");
      await sleep(200);
      created_after = new Date();
      await sleep(200);
      await pressKey(id, "2");
      const [snap] = await pressKey(id, ".");
      dot_correlation = snap?.event?.metadata?.correlation || "";
      await sleep(200);
      created_before = new Date();
      await sleep(200);
      await pressKey(id, "3");
      await pressKey(id, "=");
    });

    it("should read stream", async () => {
      const { count } = await http.query({ limit: 1 });
      expect(count).toBe(1);
    });

    it("should read stream by name", async () => {
      const { first, count } = await http.query(
        { names: ["DigitPressed"], limit: 3 },
        (e) => {
          expect(e.name).toBe("DigitPressed");
        }
      );
      expect(first?.name).toBe("DigitPressed");
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("should read stream by names", async () => {
      const { count } = await http.query(
        {
          stream: `Calculator-${id}`,
          names: ["DigitPressed", "DotPressed"],
          limit: 8
        },
        (e) => {
          expect(["DigitPressed", "DotPressed"]).toContain(e.name);
        }
      );
      expect(count).toBe(4);
    });

    it("should read stream with after", async () => {
      const { first } = await http.query({ after: 3 });
      expect(first?.id).toBe(4);
    });

    it("should read stream with limit", async () => {
      const { count } = await http.query({ limit: 5 });
      expect(count).toBe(5);
    });

    it("should read stream with after and limit", async () => {
      const { first, count } = await http.query({ after: 2, limit: 2 });
      expect(first?.id).toBe(3);
      expect(count).toBe(2);
    });

    it("should return an empty stream", async () => {
      const { count } = await http.query({ names: [chance.guid()] });
      expect(count).toBe(0);
    });

    it("should read stream with before and after", async () => {
      const { first, count } = await http.query({
        after: 2,
        before: 4,
        limit: 5
      });
      expect(first?.id).toBe(3);
      expect(count).toBe(1);
    });

    it("should read stream with before and after created", async () => {
      const { first, count } = await http.query({
        stream: Calculator(id).stream(),
        created_after,
        created_before,
        limit: 5
      });
      expect(first?.version).toBe(2);
      expect(count).toBe(2);
    });

    it("should read stream by correlation", async () => {
      const { count } = await http.query(
        {
          correlation: dot_correlation,
          limit: 5
        },
        (e) => expect(e.name).toBe("DotPressed")
      );
      expect(count).toBe(1);
    });

    it("should read snapshot", async () => {
      const snaps = await http.get("/calculator");
      expect(snaps).toBeDefined();
    });
  });

  describe("swagger", () => {
    it("should get swagger spec", async () => {
      const swagger = await http.get("/swagger");
      expect(swagger.status).toBe(200);
    });

    it("should get store stats", async () => {
      const stats = await http.get("/stats");
      expect(stats.status).toBe(200);
    });

    it("should get redoc spec", async () => {
      const swagger = await http.get("/_redoc");
      expect(swagger.status).toBe(200);
    });

    it("should get _health", async () => {
      const swagger = await http.get("/_health");
      expect(swagger.status).toBe(200);
    });

    it("should get _config", async () => {
      const swagger = await http.get("/_config");
      expect(swagger.status).toBe(200);
    });

    it("should get home", async () => {
      const swagger = await http.get("/");
      expect(swagger.status).toBe(200);
    });
  });
});
