import { App, Errors } from "@rotorsoft/eventually";
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
      await app.command(Calculator, "test", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test", commands.PressKey({ key: "+" }));
      await app.command(Calculator, "test", commands.PressKey({ key: "2" }));
      await app.command(Calculator, "test", commands.PressKey({ key: "." }));
      await app.command(Calculator, "test", commands.PressKey({ key: "3" }));
      await app.command(Calculator, "test", commands.PressKey({ key: "=" }));

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
      await app.command(Calculator, "test2", commands.PressKey({ key: "+" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "-" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "2" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "*" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "3" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "/" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "3" }));
      await app.command(Calculator, "test2", commands.PressKey({ key: "=" }));

      const { state } = await app.load(Calculator, "test2");
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });
    });

    it("should read aggregate stream", async () => {
      const snapshots = await app.stream(Calculator, "test2");
      expect(snapshots.length).toBe(9);
    });

    it("should throw concurrency error", async () => {
      await app.command(Calculator, "test", commands.PressKey({ key: "1" }));
      await expect(
        app.command(Calculator, "test", commands.PressKey({ key: "1" }), "-1")
      ).rejects.toThrowError(Errors.ConcurrencyError);
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
      await app.command(Calculator, "test3", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "1" }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "2" }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "." }));
      await app.command(Calculator, "test3", commands.PressKey({ key: "3" }));

      const { state } = await app.load(Calculator, "test3");
      expect(state).toEqual({ result: 0 });
    });
  });
});
