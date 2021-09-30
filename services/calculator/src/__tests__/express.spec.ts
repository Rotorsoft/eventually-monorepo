import { App, EvtOf } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Calculator } from "../calculator.aggregate";
import { Counter } from "../counter.policy";
import { commands } from "../calculator.commands";
import { Events, events } from "../calculator.events";
import { command, event, load, read, stream } from "./http";

const app = App(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withAggregate(Calculator)
  .withPolicy(Counter);

describe("express app", () => {
  beforeAll(async () => {
    app.build();
    await app.listen();
  });

  afterAll(() => {
    app.close();
  });

  describe("Calculator", () => {
    it("should compute correctly", async () => {
      await command(Calculator, "test", commands.PressKey({ key: "1" }));
      await command(Calculator, "test", commands.PressKey({ key: "+" }));
      await command(Calculator, "test", commands.PressKey({ key: "2" }));
      await command(Calculator, "test", commands.PressKey({ key: "." }));
      await command(Calculator, "test", commands.PressKey({ key: "3" }));
      await command(Calculator, "test", commands.PressKey({ key: "=" }));

      const { state } = await load(Calculator, "test");
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      const snapshots = await stream(Calculator, "test");
      expect(snapshots.length).toEqual(6);
    });

    it("should compute correctly 2", async () => {
      await command(Calculator, "test2", commands.PressKey({ key: "+" }));
      await command(Calculator, "test2", commands.PressKey({ key: "1" }));
      await command(Calculator, "test2", commands.PressKey({ key: "-" }));
      await command(Calculator, "test2", commands.PressKey({ key: "2" }));
      await command(Calculator, "test2", commands.PressKey({ key: "*" }));
      await command(Calculator, "test2", commands.PressKey({ key: "3" }));
      await command(Calculator, "test2", commands.PressKey({ key: "/" }));
      await command(Calculator, "test2", commands.PressKey({ key: "3" }));
      await command(Calculator, "test2", commands.PressKey({ key: "=" }));

      const { state } = await load(Calculator, "test2");
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });
    });

    it("should read aggregate stream", async () => {
      const snapshots = await stream(Calculator, "test2");
      expect(snapshots.length).toBe(9);
    });

    it("should throw concurrency error", async () => {
      await command(Calculator, "test", commands.PressKey({ key: "1" }));
      await expect(
        command(Calculator, "test", commands.PressKey({ key: "1" }), "-1")
      ).rejects.toThrowError("Request failed with status code 409");
    });

    it("should throw validation error", async () => {
      await expect(
        command(Calculator, "test", {
          name: "PressKey",
          schema: () => undefined
        })
      ).rejects.toThrowError("Request failed with status code 400");
    });
  });

  describe("Counter", () => {
    it("should reset on last key pressed", async () => {
      await command(Calculator, "test3", commands.PressKey({ key: "1" }));
      await command(Calculator, "test3", commands.PressKey({ key: "1" }));
      await command(Calculator, "test3", commands.PressKey({ key: "2" }));
      await command(Calculator, "test3", commands.PressKey({ key: "." }));
      await command(Calculator, "test3", commands.PressKey({ key: "3" }));

      const { state } = await load(Calculator, "test3");
      expect(state).toEqual({ result: 0 });
    });

    it("should return no command", async () => {
      const snapshots = await stream(Calculator, "test3");
      const response = await event(
        Counter,
        snapshots[0].event as EvtOf<Pick<Events, "DigitPressed" | "DotPressed">>
      );
      expect(response).toBe("");
    });

    it("should throw validation error", async () => {
      await expect(
        event(Counter, {
          eventId: 1,
          aggregateId: "Calculator:test3",
          aggregateVersion: "1",
          createdAt: new Date(),
          name: "DigitPressed"
        })
      ).rejects.toThrowError("Request failed with status code 400");
    });
  });

  describe("all stream", () => {
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
      expect(stream[0].eventId).toBe(4);
    });

    it("should read stream with limit", async () => {
      const stream = await read({ limit: 5 });
      expect(stream.length).toBe(5);
    });

    it("should read stream with after and limit", async () => {
      const stream = await read({ after: 2, limit: 2 });
      expect(stream[0].eventId).toBe(3);
      expect(stream.length).toBe(2);
    });
  });
});