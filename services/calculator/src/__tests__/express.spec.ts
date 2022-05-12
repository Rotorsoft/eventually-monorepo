import {
  app,
  bind,
  dispose,
  Message,
  Payload,
  Snapshot
} from "@rotorsoft/eventually";
import {
  ExpressApp,
  GcpGatewayMiddleware,
  tester
} from "@rotorsoft/eventually-express";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import * as schemas from "../calculator.schemas";
import { Commands } from "../calculator.commands";
import { Events } from "../calculator.events";
import { CalculatorModel, Keys } from "../calculator.models";
import { StatelessCounter } from "../counter.policy";

const chance = new Chance();
const port = 4000;
const t = tester(port);

const expressApp = new ExpressApp();
app(expressApp)
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withCommandHandlers(Calculator)
  .withEventHandlers(StatelessCounter)
  .build([GcpGatewayMiddleware]);

const pressKey = (
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel>[]> =>
  t.command(Calculator, bind("PressKey", { key }, id), {
    "X-Apigateway-Api-Userinfo":
      "eyJzdWIiOiJhY3Rvci1uYW1lIiwicm9sZXMiOlsiYWRtaW4iXSwiZW1haWwiOiJhY3RvckBlbWFpbC5jb20ifQ=="
  });

const reset = (id: string): Promise<Snapshot<CalculatorModel>[]> =>
  t.command(Calculator, bind("Reset", undefined, id));

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
      await pressKey(id, "=");

      const { state } = await t.load(Calculator, id);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      const calc_snapshots = await t.stream(Calculator, id);
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

      const { state, event } = await t.load(Calculator, id);
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });
      expect(event.metadata.causation.command.actor).toEqual({
        name: "actor-name",
        roles: ["admin"]
      });

      const snapshots = await t.stream(Calculator, id);
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

      const snapshots = await t.stream(Calculator, id, { useSnapshots: true });
      expect(snapshots.length).toBe(1);
    });

    it("should not load events", async () => {
      const { event } = await t.load(Calculator, chance.guid());
      expect(event).toBeUndefined();
    });

    it("should not load stream", async () => {
      const snapshots = await t.stream(Calculator, chance.guid());
      expect(snapshots.length).toBe(0);
    });

    it("should throw concurrency error", async () => {
      const id = chance.guid();

      await pressKey(id, "1");
      await expect(
        t.command(Calculator, bind("PressKey", { key: "1" }, id, -1))
      ).rejects.toThrowError("Request failed with status code 409");
    });

    it("should throw validation error", async () => {
      await expect(
        t.command(Calculator, bind("PressKey", {}, chance.guid()))
      ).rejects.toThrowError("Request failed with status code 400");
    });

    it("should throw 404 error", async () => {
      await expect(t.get("/calculator")).rejects.toThrowError(
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

      const { state } = await t.load(Calculator, id);
      expect(state).toEqual({ result: 0 });
    });

    it("should return no command", async () => {
      const snapshots = await pressKey(chance.guid(), "1");
      const response = await t.event(
        StatelessCounter,
        snapshots[0].event as Message<"DigitPressed", Payload>
      );
      expect(response).toStrictEqual({});
    });

    it("should return no command 2", async () => {
      const snapshots = await pressKey(chance.guid(), ".");
      const response = await t.event(
        StatelessCounter,
        snapshots[0].event as Message<"DotPressed", Payload>
      );
      expect(response).toStrictEqual({});
    });

    it("should throw validation error", async () => {
      await expect(
        t.event(
          StatelessCounter,
          bind("DigitPressed", {
            id: 1,
            stream: chance.guid(),
            version: 1,
            created: new Date(),
            name: "DigitPressed"
          })
        )
      ).rejects.toThrowError("Request failed with status code 400");
    });

    it("should return nothing but OK", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const response = await t.event(StatelessCounter, {
        name: "IgnoreThis"
      } as any);
      expect(response).toBe("Ignored IgnoreThis");
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
      await t.sleep(200);
      created_after = new Date();
      await t.sleep(200);
      await pressKey(id, "2");
      const [snap] = await pressKey(id, ".");
      dot_correlation = snap.event.metadata.correlation;
      await t.sleep(200);
      created_before = new Date();
      await t.sleep(200);
      await pressKey(id, "3");
      await pressKey(id, "=");
    });

    it("should read stream", async () => {
      const events = await t.read();
      expect(events.length).toBe(1);
    });

    it("should read stream by name", async () => {
      const stream = await t.read({ names: ["DigitPressed"], limit: 3 });
      expect(stream[0].name).toBe("DigitPressed");
      expect(stream.length).toBeGreaterThanOrEqual(3);
      stream.map((evt) => expect(evt.name).toBe("DigitPressed"));
    });

    it("should read stream by names", async () => {
      const stream = await t.read({
        stream: `Calculator-${id}`,
        names: ["DigitPressed", "DotPressed"],
        limit: 8
      });
      expect(stream.length).toBe(4);
      stream.map((evt) =>
        expect(["DigitPressed", "DotPressed"]).toContain(evt.name)
      );
    });

    it("should read stream with after", async () => {
      const stream = await t.read({ after: 3 });
      expect(stream[0].id).toBe(4);
    });

    it("should read stream with limit", async () => {
      const stream = await t.read({ limit: 5 });
      expect(stream.length).toBe(5);
    });

    it("should read stream with after and limit", async () => {
      const stream = await t.read({ after: 2, limit: 2 });
      expect(stream[0].id).toBe(3);
      expect(stream.length).toBe(2);
    });

    it("should return an empty stream", async () => {
      const stream = await t.read({ names: [chance.guid()] });
      expect(stream.length).toBe(0);
    });

    it("should read stream with before and after", async () => {
      const stream = await t.read({ after: 2, before: 4, limit: 5 });
      expect(stream[0].id).toBe(3);
      expect(stream.length).toBe(1);
    });

    it("should read stream with before and after created", async () => {
      const stream = await t.read({
        stream: Calculator(id).stream(),
        created_after,
        created_before,
        limit: 5
      });
      expect(stream[0].version).toBe(2);
      expect(stream.length).toBe(2);
    });

    it("should read stream by correlation", async () => {
      const stream = await t.read({
        correlation: dot_correlation,
        limit: 5
      });
      expect(stream.length).toBe(1);
      expect(stream[0].name).toBe("DotPressed");
    });
  });

  describe("swagger", () => {
    it("should get swagger spec", async () => {
      const swagger = await t.get("/swagger");
      expect(swagger.status).toBe(200);
    });

    it("should get store stats", async () => {
      const stats = await t.get("/stats");
      expect(stats.status).toBe(200);
    });

    it("should get swagger prop", () => {
      const swagger = expressApp.getSwagger();
      expect(swagger).toBeDefined();
    });

    it("should get redoc spec", async () => {
      const swagger = await t.get("/redoc");
      expect(swagger.status).toBe(200);
    });

    it("should get rapidoc spec", async () => {
      const swagger = await t.get("/rapidoc");
      expect(swagger.status).toBe(200);
    });

    it("should get _health", async () => {
      const swagger = await t.get("/_health");
      expect(swagger.status).toBe(200);
    });

    it("should get home", async () => {
      const swagger = await t.get("/");
      expect(swagger.status).toBe(200);
    });
  });
});
