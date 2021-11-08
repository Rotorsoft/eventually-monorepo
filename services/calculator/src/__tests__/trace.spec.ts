process.env.LOG_LEVEL = "trace";

import { app, bind } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { Chance } from "chance";

const chance = new Chance();

app()
  .withCommandHandlers(Calculator)
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
      const id = chance.guid();

      await app().command(
        Calculator,
        bind(commands.PressKey, { key: "1" }, id)
      );

      const { state } = await app().load(Calculator(id));
      expect(state).toEqual({
        left: "1",
        result: 0
      });
    });
  });
});
