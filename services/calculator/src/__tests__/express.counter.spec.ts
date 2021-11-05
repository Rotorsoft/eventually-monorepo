process.env.PORT = "3006";

import { app } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import { command, load, sleep, stream } from "@rotorsoft/eventually-test";
import { Chance } from "chance";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { Counter } from "../counter.policy";

const chance = new Chance();
const port = +process.env.PORT;

app(new ExpressApp())
  .withEvents(events)
  .withCommands(commands)
  .withCommandHandlers(Calculator)
  .withEventHandlers(Counter)
  .build();

describe("express app", () => {
  beforeAll(async () => {
    await app().listen();
  });

  afterAll(async () => {
    await app().close();
  });

  describe("Calculator", () => {
    it("should compute correctly", async () => {
      const id = chance.guid();

      await command(
        Calculator,
        commands.PressKey,
        { key: "1" },
        id,
        undefined,
        port
      );
      await sleep(100);
      await command(
        Calculator,
        commands.PressKey,
        { key: "+" },
        id,
        undefined,
        port
      );
      await sleep(100);
      await command(
        Calculator,
        commands.PressKey,
        { key: "2" },
        id,
        undefined,
        port
      );
      await sleep(100);
      await command(
        Calculator,
        commands.PressKey,
        { key: "." },
        id,
        undefined,
        port
      );
      await sleep(100);
      await command(
        Calculator,
        commands.PressKey,
        { key: "3" },
        id,
        undefined,
        port
      );
      await sleep(100);
      await command(
        Calculator,
        commands.PressKey,
        { key: "=" },
        id,
        undefined,
        port
      );
      await sleep(100);

      const { state } = await load(Calculator, id, port);
      expect(state).toEqual({
        left: "3.3",
        operator: "+",
        result: 3.3
      });

      const calc_snapshots = await stream(Calculator, id, { port });
      expect(calc_snapshots.length).toEqual(6);

      const count_snapshots = await stream(Counter, `CounterCalculator${id}`, {
        port
      });
      expect(count_snapshots.length).toEqual(6);
    });
  });
});
