import { App, Errors, log } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import * as schemas from "../calculator.schemas";
import { Counter } from "../counter.policy";

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
      // GIVEN
      await app.command(Calculator, "test", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test", commands.PressKey({ key: "+" }));
      await app.command(Calculator, "test", commands.PressKey({ key: "2" }));
      await app.command(Calculator, "test", commands.PressKey({ key: "." }));
      await app.command(Calculator, "test", commands.PressKey({ key: "3" }));

      // WHEN
      await app.command(Calculator, "test", commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app.load(Calculator, "test");
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });
      const snapshots = await app.stream(Calculator, "test");
      expect(snapshots.length).toEqual(6);
    });

    it("should compute correctly 2", async () => {
      // GIVEN
      await app.command(Calculator, "test2", commands.PressKey({ key: "+" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "-" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "2" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "*" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "3" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "/" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "3" }));

      // WHEN
      await app.command(Calculator, "test2", commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app.load(Calculator, "test2");
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });
    });

    it("should compute correctly 3", async () => {
      // GIVEN
      await app.command(Calculator, "test3", commands.PressKey({ key: "." }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "+" }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "." }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "2" }));

      // WHEN
      await app.command(Calculator, "test3", commands.PressKey({ key: "=" }));

      // THEN
      const { state } = await app.load(Calculator, "test3");
      expect(state).toEqual({
        left: "0.3",
        operator: "+",
        result: 0.3
      });
    });

    it("should read aggregate stream", async () => {
      const snapshots = await app.stream(Calculator, "test2");
      expect(snapshots.length).toBe(9);
    });

    it("should throw concurrency error", async () => {
      // GIVEN
      await app.command(Calculator, "test", commands.PressKey({ key: "1" }));

      // WHEN
      await expect(
        app.command(Calculator, "test", commands.PressKey({ key: "1" }), "-1")
      )
        // THEN
        .rejects.toThrowError(Errors.ConcurrencyError);
    });

    it("should throw validation error", async () => {
      await expect(
        app.command(Calculator, "test", {
          name: "PressKey",
          schema: () => schemas.PressKey
        })
      ).rejects.toThrowError(Errors.ValidationError);
    });
  });

  describe("Counter", () => {
    it("should return Reset on DigitPressed", async () => {
      // GIVEN
      await app.command(Calculator, "test3", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "2" }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "." }));

      // WHEN
      await app.command(Calculator, "test3", commands.PressKey({ key: "3" }));

      // THEN
      const { state } = await app.load(Calculator, "test3");
      expect(state).toEqual({ result: 0 });
    });
  });

  it("should cover schema", () => {
    expect(commands.Whatever().schema()).toBe(schemas.Whatever);
  });

  it("should cover initialized log", () => {
    expect(log()).toBeDefined();
  });
});
