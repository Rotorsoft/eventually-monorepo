import { App, EvtOf } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { Calculator } from "../calculator.aggregate";
import { Counter, StatelessCounter } from "../counter.policy";
import { commands } from "../calculator.commands";
import { Events, events } from "../calculator.events";
import { command, event, load, read, stream, get } from "./http";

const app = App(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withAggregate(Calculator)
  .withPolicy(Counter)
  .withPolicy(StatelessCounter);

describe("express app", () => {
  beforeAll(async () => {
    app.build();
    await app.listen();
  });

  afterAll(async () => {
    await app.close();
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

    it("should not load events", async () => {
      const { event } = await load(Calculator, "impossible ");
      expect(event).toBeUndefined();
    });

    it("should not load stream", async () => {
      const snapshots = await stream(Calculator, "impossible ");
      expect(snapshots.length).toBe(0);
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

    it("should throw 404 error", async () => {
      await expect(get("/calculator")).rejects.toThrowError(
        "Request failed with status code 404"
      );
    });

    it("should throw model invariant violation", async () => {
      await expect(
        command(Calculator, "test5", commands.PressKey({ key: "=" }))
      ).rejects.toThrowError("Request failed with status code 500");
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
      const snapshots = await command(
        Calculator,
        "test3",
        commands.PressKey({ key: "1" })
      );
      const response = await event(
        Counter,
        snapshots[0].event as EvtOf<Pick<Events, "DigitPressed" | "DotPressed">>
      );
      expect(response).toBe("");
    });

    it("should throw validation error", async () => {
      await expect(
        event(Counter, {
          id: 1,
          stream: "Calculator:test3",
          version: 1,
          created: new Date(),
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
      const stream = await read({ name: "impossible " });
      expect(stream.length).toBe(0);
    });
  });
});
