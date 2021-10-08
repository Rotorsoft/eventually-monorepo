import { App, Errors, EvtOf, log } from "@rotorsoft/eventually";
import { sleep } from "@rotorsoft/eventually-test";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import * as schemas from "../calculator.schemas";
import { Counter, CounterEvents } from "../counter.policy";

const app = App()
  .withAggregate(Calculator)
  .withPolicy(Counter)
  .withEvents(events)
  .withCommands(commands);

describe("in memory app", () => {
  beforeAll(async () => {
    app.build();
    await app.listen();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("calculator", () => {
    it("should compute correctly", async () => {
      const test = Calculator("test");

      // GIVEN
      await app.command(test, commands.PressKey({ key: "1" }));
      await app.command(test, commands.PressKey({ key: "+" }));
      await app.command(test, commands.PressKey({ key: "2" }));
      await app.command(test, commands.PressKey({ key: "." }));
      await app.command(test, commands.PressKey({ key: "3" }));

      // WHEN
      await app.command(test, commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app.load(test);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });
      const snapshots = await app.stream(test);
      expect(snapshots.length).toEqual(6);
    });

    it("should compute correctly 2", async () => {
      const test2 = Calculator("test2");

      // GIVEN
      await app.command(test2, commands.PressKey({ key: "+" }));
      await app.command(test2, commands.PressKey({ key: "1" }));
      await app.command(test2, commands.PressKey({ key: "-" }));
      await app.command(test2, commands.PressKey({ key: "2" }));
      await app.command(test2, commands.PressKey({ key: "*" }));
      await app.command(test2, commands.PressKey({ key: "3" }));
      await app.command(test2, commands.PressKey({ key: "/" }));
      await app.command(test2, commands.PressKey({ key: "3" }));

      // WHEN
      await app.command(test2, commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app.load(test2);
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });
    });

    it("should compute correctly 3", async () => {
      const test3 = Calculator("test3");

      // GIVEN
      await app.command(test3, commands.PressKey({ key: "." }));
      await app.command(test3, commands.PressKey({ key: "1" }));
      await app.command(test3, commands.PressKey({ key: "+" }));
      await app.command(test3, commands.PressKey({ key: "." }));
      await app.command(test3, commands.PressKey({ key: "2" }));

      // WHEN
      await app.command(test3, commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app.load(test3);
      expect(state).toEqual({
        left: "0.3",
        operator: "+",
        result: 0.3
      });
    });

    it("should read aggregate stream", async () => {
      const snapshots = await app.stream(Calculator("test2"));
      expect(snapshots.length).toBe(9);
    });

    it("should throw concurrency error", async () => {
      const test4 = Calculator("test4");

      // GIVEN
      await app.command(test4, commands.PressKey({ key: "1" }));

      // WHEN
      await expect(app.command(test4, commands.PressKey({ key: "1" }), -1))
        // THEN
        .rejects.toThrowError(Errors.ConcurrencyError);
    });

    it("should throw validation error", async () => {
      await expect(
        app.command(Calculator("test5"), {
          name: "PressKey",
          schema: () => schemas.PressKey
        })
      ).rejects.toThrowError(Errors.ValidationError);
    });

    it("should throw model invariant violation", async () => {
      await expect(
        app.command(Calculator("test6"), commands.PressKey({ key: "=" }))
      ).rejects.toThrowError("Don't have an operator");
    });
  });

  describe("Counter", () => {
    it("should return Reset on DigitPressed", async () => {
      const test7 = Calculator("test7");

      // GIVEN
      await app.command(test7, commands.Reset());
      await app.command(test7, commands.PressKey({ key: "1" }));
      await sleep(10);
      await app.command(test7, commands.PressKey({ key: "1" }));
      await sleep(10);
      await app.command(test7, commands.PressKey({ key: "2" }));
      await sleep(10);
      await app.command(test7, commands.PressKey({ key: "." }));
      await sleep(10);

      // WHEN
      await app.command(test7, commands.PressKey({ key: "3" }));
      await sleep(10);

      // THEN
      const { event, state } = await app.load(test7);
      expect(state).toEqual({ result: 0 });

      const stream = await app.stream(
        Counter(event as EvtOf<CounterEvents>).reducer
      );
      expect(stream.length).toBe(5);
    });
  });

  it("should cover schema", () => {
    expect(commands.Whatever().schema()).toBe(schemas.Whatever);
  });

  it("should cover initialized log", () => {
    expect(log()).toBeDefined();
  });
});
