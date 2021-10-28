process.env.LOG_LEVEL = "trace";

import { app } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";

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
      const test = Calculator("test");

      await app().command(test, commands.PressKey({ key: "1" }));

      const { state } = await app().load(test);
      expect(state).toEqual({
        left: "1",
        result: 0
      });
    });
  });
});
