import { app, Errors, EvtOf, log } from "@rotorsoft/eventually";
import { sleep } from "@rotorsoft/eventually-test";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import * as schemas from "../calculator.schemas";
import { Counter, CounterEvents } from "../counter.policy";

const chance = new Chance();

app()
  .withCommandHandlers(Calculator)
  .withEventHandlers(Counter)
  .withEvents(events)
  .withCommands(commands)
  .build();

describe("in memory app", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await app().close();
  });

  describe("calculator", () => {
    it("should compute correctly", async () => {
      const test = Calculator(chance.guid());

      // GIVEN
      await app().command(test, commands.PressKey({ key: "1" }));
      await app().command(test, commands.PressKey({ key: "+" }));
      await app().command(test, commands.PressKey({ key: "2" }));
      await app().command(test, commands.PressKey({ key: "." }));
      await app().command(test, commands.PressKey({ key: "3" }));

      // WHEN
      await app().command(test, commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app().load(test);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      // With no Snapshot loading
      const snapshots1 = await app().stream(test);
      expect(snapshots1.length).toEqual(6);

      // With Snapshot loading
      const snapshots2 = await app().stream(test, true);
      expect(snapshots2.length).toEqual(2);
    });

    it("should compute correctly 2", async () => {
      const test2 = Calculator(chance.guid());
      // GIVEN
      await app().command(test2, commands.PressKey({ key: "+" }));
      await app().command(test2, commands.PressKey({ key: "1" }));
      await app().command(test2, commands.PressKey({ key: "-" }));
      await app().command(test2, commands.PressKey({ key: "2" }));
      await app().command(test2, commands.PressKey({ key: "*" }));
      await app().command(test2, commands.PressKey({ key: "3" }));
      await app().command(test2, commands.PressKey({ key: "/" }));
      await app().command(test2, commands.PressKey({ key: "3" }));

      // WHEN
      await app().command(test2, commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app().load(test2);
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });

      const snapshots = await app().stream(test2);
      expect(snapshots.length).toBe(9);
    });

    it("should read aggregate stream", async () => {
      const test2 = Calculator(chance.guid());
      // GIVEN
      await app().command(test2, commands.PressKey({ key: "+" }));
      await app().command(test2, commands.PressKey({ key: "1" }));
      await app().command(test2, commands.PressKey({ key: "-" }));
      await app().command(test2, commands.PressKey({ key: "2" }));
      await app().command(test2, commands.PressKey({ key: "*" }));
      await app().command(test2, commands.PressKey({ key: "3" }));
      await app().command(test2, commands.PressKey({ key: "/" }));
      await app().command(test2, commands.PressKey({ key: "3" }));

      // WHEN
      await app().command(test2, commands.PressKey({ key: "=" }));
      const snapshots = await app().stream(test2);
      expect(snapshots.length).toBe(9);
    });

    it("should read aggregate stream using Snapshots", async () => {
      const test2 = Calculator(chance.guid());
      // GIVEN
      await app().command(test2, commands.PressKey({ key: "+" }));
      await app().command(test2, commands.PressKey({ key: "1" }));
      await app().command(test2, commands.PressKey({ key: "-" }));
      await app().command(test2, commands.PressKey({ key: "2" }));
      await app().command(test2, commands.PressKey({ key: "*" }));
      await app().command(test2, commands.PressKey({ key: "3" }));
      await app().command(test2, commands.PressKey({ key: "/" }));
      await app().command(test2, commands.PressKey({ key: "3" }));

      // WHEN
      await app().command(test2, commands.PressKey({ key: "=" }));
      const snapshots = await app().stream(test2, true);
      expect(snapshots.length).toBe(1);
    });

    it("should compute correctly 3", async () => {
      const test3 = Calculator(chance.guid());

      // GIVEN
      await app().command(test3, commands.PressKey({ key: "." }));
      await app().command(test3, commands.PressKey({ key: "1" }));
      await app().command(test3, commands.PressKey({ key: "+" }));
      await app().command(test3, commands.PressKey({ key: "." }));
      await app().command(test3, commands.PressKey({ key: "2" }));

      // WHEN
      await app().command(test3, commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app().load(test3);
      expect(state).toEqual({
        left: "0.3",
        operator: "+",
        result: 0.3
      });
    });

    it("should throw concurrency error", async () => {
      const test4 = Calculator(chance.guid());

      // GIVEN
      await app().command(test4, commands.PressKey({ key: "1" }));

      // WHEN
      await expect(app().command(test4, commands.PressKey({ key: "1" }), -1))
        // THEN
        .rejects.toThrowError(Errors.ConcurrencyError);
    });

    it("should throw validation error", async () => {
      await expect(
        app().command(Calculator(chance.guid()), {
          name: "PressKey",
          scope: () => "public",
          schema: () => schemas.PressKey
        })
      ).rejects.toThrowError(Errors.ValidationError);
    });

    it("should throw model invariant violation", async () => {
      await expect(
        app().command(
          Calculator(chance.guid()),
          commands.PressKey({ key: "=" })
        )
      ).rejects.toThrowError("Don't have an operator");
    });
  });

  describe("Counter", () => {
    it("should return Reset on DigitPressed", async () => {
      const test7 = Calculator(chance.guid());

      // GIVEN
      await app().command(test7, commands.Reset());
      await sleep(100);
      await app().command(test7, commands.PressKey({ key: "1" }));
      await sleep(100);
      await app().command(test7, commands.PressKey({ key: "1" }));
      await sleep(100);
      await app().command(test7, commands.PressKey({ key: "2" }));
      await sleep(100);
      await app().command(test7, commands.PressKey({ key: "." }));
      await sleep(100);

      // WHEN
      await app().command(test7, commands.PressKey({ key: "3" }));
      await sleep(100);

      // THEN
      const { event, state } = await app().load(test7);
      expect(state).toEqual(expect.objectContaining({ result: 0 }));

      const stream = await app().stream(Counter(event as EvtOf<CounterEvents>));
      expect(stream.length).toBe(5);
    });

    it("should cover empty calculator", async () => {
      const test8 = Calculator(chance.guid());
      await app().event(Counter, {
        id: 0,
        stream: test8.stream(),
        version: 0,
        created: new Date(),
        ...events.DigitPressed({ digit: "0" })
      });
      const { state } = await app().load(test8);
      expect(state).toEqual({ result: 0 });
    });
  });

  it("should cover whatever command", () => {
    const cmd = commands.Whatever();
    expect(cmd.scope()).toBe("private");
  });

  it("should cover event scopes", () => {
    Object.values(events).map((f) => {
      const e = f();
      expect(e.scope()).toEqual(e.scope());
    });
  });

  it("should cover initialized log", () => {
    expect(log()).toBeDefined();
  });

  describe("all stream", () => {
    const test = Calculator(chance.guid());

    beforeAll(async () => {
      await app().command(test, commands.PressKey({ key: "1" }));
      await app().command(test, commands.PressKey({ key: "+" }));
      await app().command(test, commands.PressKey({ key: "2" }));
      await app().command(test, commands.PressKey({ key: "." }));
      await app().command(test, commands.PressKey({ key: "3" }));
      await app().command(test, commands.PressKey({ key: "=" }));
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
      const stream = await app().query({ stream: test.stream() });
      expect(stream.length).toBe(6);
    });

    it("should return an empty stream", async () => {
      const stream = await app().query({ name: chance.guid() });
      expect(stream.length).toBe(0);
    });
  });
});
