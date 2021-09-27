import { App, test_command } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";

describe("calculator", () => {
  beforeAll(async () => {
    await App()
      .withEvents(events)
      .withCommands(commands)
      .withAggregate(Calculator)
      .build();
  });

  it("should compute correctly", async () => {
    await test_command(Calculator, "test", commands.PressKey({ key: "1" }));
    await test_command(Calculator, "test", commands.PressKey({ key: "+" }));
    await test_command(Calculator, "test", commands.PressKey({ key: "2" }));
    await test_command(Calculator, "test", commands.PressKey({ key: "." }));
    await test_command(Calculator, "test", commands.PressKey({ key: "3" }));
    await test_command(Calculator, "test", commands.PressKey({ key: "=" }));

    const { state } = await App().load(Calculator, "test");
    expect(state).toEqual({
      left: "3.3",
      operator: "+",
      result: 3.3
    });
  });
});
