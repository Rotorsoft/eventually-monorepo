process.env.LOG_LEVEL = "trace";

import { App } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";

const app = App()
  .withAggregate(Calculator)
  .withEvents(events)
  .withCommands(commands);

describe("in memory app", () => {
  beforeAll(async () => {
    await app.listen();
  });

  describe("calculator", () => {
    it("should compute correctly", async () => {
      const test = Calculator("test");

      await app.command(test, commands.PressKey({ key: "1" }));

      const { state } = await app.load(test);
      expect(state).toEqual({
        left: "1",
        result: 0
      });
    });
  });
});
