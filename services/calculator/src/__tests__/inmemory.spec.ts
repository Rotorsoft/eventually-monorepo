import {
  app,
  bind,
  broker,
  CommittedEvent,
  Errors,
  log,
  Payload,
  Snapshot,
  store
} from "@rotorsoft/eventually";
import { sleep } from "@rotorsoft/eventually-test";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import * as schemas from "../calculator.schemas";
import { Commands } from "../calculator.commands";
import { Keys, CalculatorModel } from "../calculator.models";
import { Events } from "../calculator.events";
import { Counter, IgnoredHandler } from "../counter.policy";

const chance = new Chance();

app()
  .withCommandHandlers(Calculator)
  .withEventHandlers(Counter, IgnoredHandler)
  .withSchemas<Pick<Commands, "PressKey">>({
    PressKey: schemas.PressKey
  })
  .withSchemas<Pick<Events, "DigitPressed" | "OperatorPressed">>({
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  })
  .withPrivate<Commands>("Whatever", "Reset")
  .withPrivate<Events>(
    "OperatorPressed",
    "EqualsPressed",
    "Ignored1",
    "Ignored3"
  )
  .build();

const pressKey = (
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel>[]> =>
  app().command(bind("PressKey", { key }, id));

const reset = (id: string): Promise<Snapshot<CalculatorModel>[]> =>
  app().command(bind("Reset", undefined, id));

describe("in memory app", () => {
  beforeAll(async () => {
    jest.clearAllMocks();
    await app().listen();
  });

  afterAll(async () => {
    await app().close();
  });

  describe("calculator", () => {
    it("should compute correctly", async () => {
      const id = chance.guid();

      // GIVEN
      await pressKey(id, "1");
      await pressKey(id, "+");
      await pressKey(id, "2");
      await pressKey(id, ".");
      await pressKey(id, "3");

      // WHEN
      await pressKey(id, "=");

      // THEN
      const { state } = await app().load(Calculator(id));
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      // With no Snapshot loading
      const snapshots1 = await app().stream(Calculator(id));
      expect(snapshots1.length).toEqual(6);

      // With Snapshot loading
      const snapshots2 = await app().stream(Calculator(id), true);
      expect(snapshots2.length).toEqual(2);
    });

    it("should compute correctly 2", async () => {
      const id = chance.guid();
      // GIVEN
      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "-");
      await pressKey(id, "2");
      await pressKey(id, "*");
      await pressKey(id, "3");
      await pressKey(id, "/");
      await pressKey(id, "3");

      // WHEN
      await pressKey(id, "=");

      // THEN
      const { state } = await app().load(Calculator(id));
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });

      const snapshots = await app().stream(Calculator(id));
      expect(snapshots.length).toBe(9);
    });

    it("should read aggregate stream", async () => {
      const id = chance.guid();
      // GIVEN
      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "-");
      await pressKey(id, "2");
      await pressKey(id, "*");
      await pressKey(id, "3");
      await pressKey(id, "/");
      await pressKey(id, "3");

      // WHEN
      await pressKey(id, "=");
      const snapshots = await app().stream(Calculator(id));
      expect(snapshots.length).toBe(9);
    });

    it("should read aggregate stream using Snapshots", async () => {
      const id = chance.guid();
      // GIVEN
      await pressKey(id, "+");
      await pressKey(id, "1");
      await pressKey(id, "-");
      await pressKey(id, "2");
      await pressKey(id, "*");
      await pressKey(id, "3");
      await pressKey(id, "/");
      await pressKey(id, "3");

      // WHEN
      await pressKey(id, "=");
      const snapshots = await app().stream(Calculator(id), true);
      expect(snapshots.length).toBe(1);
    });

    it("should compute correctly 3", async () => {
      const id = chance.guid();

      // GIVEN
      await pressKey(id, ".");
      await pressKey(id, "1");
      await pressKey(id, "+");
      await pressKey(id, ".");
      await pressKey(id, "2");

      // WH, id)EN
      await pressKey(id, "=");

      // THEN
      const { state } = await app().load(Calculator(id));
      expect(state).toEqual({
        left: "0.3",
        operator: "+",
        result: 0.3
      });
    });

    it("should throw concurrency error", async () => {
      const id = chance.guid();

      // GIVEN
      await pressKey(id, "1");

      // WHEN
      await expect(app().command(bind("PressKey", { key: "1" }, id, -1)))
        // THEN
        .rejects.toThrowError(Errors.ConcurrencyError);
    });

    it("should throw validation error", async () => {
      await expect(
        app().command(bind("PressKey", undefined, chance.guid()))
      ).rejects.toThrowError(Errors.ValidationError);
    });

    it("should throw model invariant violation", async () => {
      await expect(pressKey(chance.guid(), "=")).rejects.toThrowError(
        "Don't have an operator"
      );
    });

    it("should publish public events only", async () => {
      const id = chance.guid();
      const publishSpy = jest.spyOn(broker(), "publish");
      const snapshots = await reset(id);
      expect(snapshots.length).toBe(3);
      expect(publishSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Counter", () => {
    it("should return Reset on DigitPressed", async () => {
      const id = chance.guid();

      // GIVEN
      await reset(id);
      await sleep(100);
      await pressKey(id, "1");
      await sleep(100);
      await pressKey(id, "1");
      await sleep(100);
      await pressKey(id, "2");
      await sleep(100);
      await pressKey(id, ".");
      await sleep(100);

      // WHEN
      await pressKey(id, "3");
      await sleep(100);

      // THEN
      const { event, state } = await app().load(Calculator(id));
      expect(state).toEqual(expect.objectContaining({ result: 0 }));

      const stream = await app().stream(Counter(event as any));
      expect(stream.length).toBe(5);
    });

    it("should return Reset on DotPressed", async () => {
      const id = chance.guid();

      // GIVEN
      await reset(id);
      await sleep(100);
      await pressKey(id, "1");
      await sleep(100);
      await pressKey(id, "1");
      await sleep(100);
      await pressKey(id, "2");
      await sleep(100);
      await pressKey(id, "2");
      await sleep(100);

      // WHEN
      await pressKey(id, ".");
      await sleep(100);

      // THEN
      const { state } = await app().load(Calculator(id));
      expect(state).toEqual(expect.objectContaining({ result: 0 }));
    });
  });

  describe("all stream", () => {
    const id = chance.guid();

    beforeAll(async () => {
      await pressKey(id, "1");
      await pressKey(id, "+");
      await pressKey(id, "2");
      await pressKey(id, ".");
      await pressKey(id, "3");
      await pressKey(id, "=");
    });

    it("should read stream", async () => {
      const events = await app().query();
      expect(events.length).toBe(1);
    });

    it("should read stream by name", async () => {
      const stream = await app().query({ name: "DigitPressed", limit: 3 });
      expect(stream[0].name).toBe("DigitPressed");
      expect(stream.length).toBeGreaterThanOrEqual(3);
      stream.map((evt) => expect(evt.name).toBe("DigitPressed"));
    });

    it("should read stream with after", async () => {
      const stream = await app().query({ after: 3 });
      expect(stream[0].id).toBe(4);
    });

    it("should read stream with limit", async () => {
      const stream = await app().query({ limit: 5 });
      expect(stream.length).toBe(5);
    });

    it("should read stream with after and limit", async () => {
      const stream = await app().query({ after: 2, limit: 2 });
      expect(stream[0].id).toBe(3);
      expect(stream.length).toBe(2);
    });

    it("should read stream with stream name", async () => {
      const stream = await app().query({ stream: Calculator(id).stream() });
      expect(stream.length).toBe(6);
    });

    it("should return an empty stream", async () => {
      const stream = await app().query({ name: chance.guid() });
      expect(stream.length).toBe(0);
    });
  });

  describe("misc", () => {
    const event = <E>(
      name: keyof E & string,
      stream: string,
      data?: Payload
    ): CommittedEvent<keyof E & string, Payload> => ({
      id: 0,
      stream,
      version: 0,
      created: new Date(),
      name,
      data
    });

    it("should cover empty calculator", async () => {
      const test8 = Calculator(chance.guid());
      await app().event(
        Counter,
        event("DigitPressed", test8.stream(), { digit: "0" })
      );
      const { state } = await app().load(test8);
      expect(state).toEqual({ result: 0 });
    });

    it("should cover initialized log", () => {
      expect(log()).toBeDefined();
    });

    it("should cover ignored handler", async () => {
      const r1 = await app().event(
        IgnoredHandler,
        event("Ignored1", "ignored")
      );
      const r2 = await app().event(
        IgnoredHandler,
        event("Ignored2", "ignored")
      );
      expect(r1.response).toBeUndefined();
      expect(r2.state).toBeUndefined();
    });

    it("should get store stats", async () => {
      const stats = await store().stats();
      expect(stats).toBeDefined();
    });
  });
});
