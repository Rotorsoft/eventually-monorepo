import { app, bind, Snapshot } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import {
  command,
  event,
  get,
  load,
  read,
  sleep,
  stream
} from "@rotorsoft/eventually-test";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import * as schemas from "../calculator.schemas";
import { Commands } from "../calculator.commands";
import { Events } from "../calculator.events";
import { CalculatorModel, Keys } from "../calculator.models";
import { StatelessCounter } from "../counter.policy";

const chance = new Chance();

const expressApp = new ExpressApp();
app(expressApp)
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withPrivate<Commands>("Whatever")
  .withPrivate<Events>("OperatorPressed")
  .withCommandHandlers(Calculator)
  .withEventHandlers(StatelessCounter)
  .build();

const pressKey = (
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel>[]> =>
  command(Calculator, bind("PressKey", { key }, id));

const reset = (id: string): Promise<Snapshot<CalculatorModel>[]> =>
  command(Calculator, bind("Reset", undefined, id));

describe("express app", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await app().close();
    await app().close();
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

      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      const calc_snapshots = await stream(Calculator, id);
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

      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });

      const snapshots = await stream(Calculator, id);
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

      const snapshots = await stream(Calculator, id, { useSnapshots: true });
      expect(snapshots.length).toBe(1);
    });

    it("should not load events", async () => {
      const { event } = await load(Calculator, chance.guid());
      expect(event).toBeUndefined();
    });

    it("should not load stream", async () => {
      const snapshots = await stream(Calculator, chance.guid());
      expect(snapshots.length).toBe(0);
    });

    it("should throw concurrency error", async () => {
      const id = chance.guid();

      await pressKey(id, "1");
      await expect(
        command(Calculator, bind("PressKey", { key: "1" }, id, -1))
      ).rejects.toThrowError("Request failed with status code 409");
    });

    it("should throw validation error", async () => {
      await expect(
        command(Calculator, bind("PressKey", {}, chance.guid()))
      ).rejects.toThrowError("Request failed with status code 400");
    });

    it("should throw 404 error", async () => {
      await expect(get("/calculator")).rejects.toThrowError(
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
      await sleep(100);
      await pressKey(id, "+");
      await sleep(100);
      await pressKey(id, "1");
      await sleep(100);
      await pressKey(id, "1");
      await sleep(100);
      await pressKey(id, "2");
      await sleep(100);
      await pressKey(id, ".");
      await sleep(100);
      await pressKey(id, "3");
      await sleep(100);

      const { state } = await load(Calculator, id);
      expect(state).toEqual({ result: 0 });
    });

    it("should return no command", async () => {
      const snapshots = await pressKey(chance.guid(), "1");
      const response = await event(
        StatelessCounter,
        bind("DigitPressed", snapshots[0].event)
      );
      expect(response).toStrictEqual({});
    });

    it("should return no command 2", async () => {
      const snapshots = await pressKey(chance.guid(), ".");
      const response = await event(
        StatelessCounter,
        bind("DotPressed", snapshots[0].event)
      );
      expect(response).toStrictEqual({});
    });

    it("should throw validation error", async () => {
      await expect(
        event(
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
      const response = await event(StatelessCounter, {
        data: { name: "IgnoreThis" }
      } as any);
      expect(response).toBe("Ignored IgnoreThis");
    });
  });

  describe("all stream", () => {
    beforeAll(async () => {
      const id = chance.guid();

      await pressKey(id, "1");
      await pressKey(id, "+");
      await pressKey(id, "2");
      await pressKey(id, ".");
      await pressKey(id, "3");
      await pressKey(id, "=");
    });

    it("should read stream", async () => {
      const events = await read();
      expect(events.length).toBe(1);
    });

    it("should read stream by name", async () => {
      const stream = await read({ name: "DigitPressed", limit: 3 });
      expect(stream[0].name).toBe("DigitPressed");
      expect(stream.length).toBeGreaterThanOrEqual(3);
      stream.map((evt) => expect(evt.name).toBe("DigitPressed"));
    });

    it("should read stream with after", async () => {
      const stream = await read({ after: 3 });
      expect(stream[0].id).toBe(4);
    });

    it("should read stream with limit", async () => {
      const stream = await read({ limit: 5 });
      expect(stream.length).toBe(5);
    });

    it("should read stream with after and limit", async () => {
      const stream = await read({ after: 2, limit: 2 });
      expect(stream[0].id).toBe(3);
      expect(stream.length).toBe(2);
    });

    it("should return an empty stream", async () => {
      const stream = await read({ name: chance.guid() });
      expect(stream.length).toBe(0);
    });
  });

  describe("swagger", () => {
    it("should get swagger spec", async () => {
      const swagger = await get("/swagger");
      expect(swagger.status).toBe(200);
    });

    it("should get store stats", async () => {
      const stats = await get("/stats");
      expect(stats.status).toBe(200);
    });

    it("should get swagger prop", async () => {
      const swagger = expressApp.getSwagger();
      expect(swagger).toBeDefined();
    });
  });
});
