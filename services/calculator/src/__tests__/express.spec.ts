import { app, EvtOf } from "@rotorsoft/eventually";
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
import { commands } from "../calculator.commands";
import { Events, events } from "../calculator.events";
import { StatelessCounter } from "../counter.policy";

const chance = new Chance();

app(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withCommandHandlers(Calculator)
  .withEventHandlers(StatelessCounter)
  .build();

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

      await command(Calculator, commands.PressKey({ key: "1" }), id);
      await command(Calculator, commands.PressKey({ key: "+" }), id);
      await command(Calculator, commands.PressKey({ key: "2" }), id);
      await command(Calculator, commands.PressKey({ key: "." }), id);
      await command(Calculator, commands.PressKey({ key: "3" }), id);
      await command(Calculator, commands.PressKey({ key: "=" }), id);

      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      const snapshots = await stream(Calculator, id);
      expect(snapshots.length).toEqual(6);
    });

    it("should compute correctly 2", async () => {
      const id = chance.guid();

      await command(Calculator, commands.PressKey({ key: "+" }), id);
      await command(Calculator, commands.PressKey({ key: "1" }), id);
      await command(Calculator, commands.PressKey({ key: "-" }), id);
      await command(Calculator, commands.PressKey({ key: "2" }), id);
      await command(Calculator, commands.PressKey({ key: "*" }), id);
      await command(Calculator, commands.PressKey({ key: "3" }), id);
      await command(Calculator, commands.PressKey({ key: "/" }), id);
      await command(Calculator, commands.PressKey({ key: "3" }), id);
      await command(Calculator, commands.PressKey({ key: "=" }), id);

      const { state } = await load(Calculator, id);
      expect(state).toEqual({
        left: "-1",
        operator: "/",
        result: -1
      });

      const snapshots = await stream(Calculator, id);
      expect(snapshots.length).toBe(9);
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

      await command(Calculator, commands.PressKey({ key: "1" }), id);
      await expect(
        command(Calculator, commands.PressKey({ key: "1" }), id, -1)
      ).rejects.toThrowError("Request failed with status code 409");
    });

    it("should throw validation error", async () => {
      await expect(
        command(Calculator, commands.PressKey(), chance.guid())
      ).rejects.toThrowError("Request failed with status code 400");
    });

    it("should throw 404 error", async () => {
      await expect(get("/calculator")).rejects.toThrowError(
        "Request failed with status code 404"
      );
    });

    it("should throw model invariant violation", async () => {
      await expect(
        command(Calculator, commands.PressKey({ key: "=" }), chance.guid())
      ).rejects.toThrowError("Request failed with status code 500");
    });
  });

  describe("Counter", () => {
    it("should reset on last key pressed", async () => {
      const id = chance.guid();

      await command(Calculator, commands.PressKey({ key: "1" }), id);
      await command(Calculator, commands.PressKey({ key: "1" }), id);
      await command(Calculator, commands.PressKey({ key: "2" }), id);
      await command(Calculator, commands.PressKey({ key: "." }), id);
      await command(Calculator, commands.PressKey({ key: "3" }), id);

      await sleep(100); // wait for counters to reset
      const { state } = await load(Calculator, id);
      expect(state).toEqual({ result: 0 });
    });

    it("should return no command", async () => {
      const snapshots = await command(
        Calculator,
        commands.PressKey({ key: "1" }),
        chance.guid()
      );
      const response = await event(
        StatelessCounter,
        snapshots[0].event as EvtOf<Pick<Events, "DigitPressed" | "DotPressed">>
      );
      expect(response).toStrictEqual({});
    });

    it("should throw validation error", async () => {
      await expect(
        event(StatelessCounter, {
          id: 1,
          stream: chance.guid(),
          version: 1,
          created: new Date(),
          ...events.DigitPressed()
        })
      ).rejects.toThrowError("Request failed with status code 400");
    });
  });

  describe("all stream", () => {
    beforeAll(async () => {
      const id = chance.guid();

      await command(Calculator, commands.PressKey({ key: "1" }), id);
      await command(Calculator, commands.PressKey({ key: "+" }), id);
      await command(Calculator, commands.PressKey({ key: "2" }), id);
      await command(Calculator, commands.PressKey({ key: "." }), id);
      await command(Calculator, commands.PressKey({ key: "3" }), id);
      await command(Calculator, commands.PressKey({ key: "=" }), id);
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
});
