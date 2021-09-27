import { App, test_command } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { Counter } from "../counter.policy";

describe("Counter", () => {
  beforeAll(async () => {
    await App()
      .withEvents(events)
      .withCommands(commands)
      .withAggregate(Calculator)
      .withPolicy(Counter)
      .build();
  });

  it("should return Reset on DigitPressed", async () => {
    await test_command(Calculator, "test", commands.PressKey({ key: "1" }));
    await test_command(Calculator, "test", commands.PressKey({ key: "1" }));
    await test_command(Calculator, "test", commands.PressKey({ key: "2" }));
    await test_command(Calculator, "test", commands.PressKey({ key: "." }));
    await test_command(Calculator, "test", commands.PressKey({ key: "3" }));

    const { state } = await App().load(Calculator, "test");
    expect(state).toEqual({ result: 0 });
  });
});
