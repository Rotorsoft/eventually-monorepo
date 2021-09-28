import { App } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { Counter } from "../counter.policy";

describe("Counter", () => {
  const app = App()
    .withAggregate(Calculator)
    .withPolicy(Counter)
    .withEvents(events)
    .withCommands(commands);

  beforeAll(async () => {
    app.build();
    await app.listen();
  });

  it("should return Reset on DigitPressed", async () => {
    await app.command(Calculator, "test", commands.PressKey({ key: "1" }));
    await app.command(Calculator, "test", commands.PressKey({ key: "1" }));
    await app.command(Calculator, "test", commands.PressKey({ key: "2" }));
    await app.command(Calculator, "test", commands.PressKey({ key: "." }));
    await app.command(Calculator, "test", commands.PressKey({ key: "3" }));

    const { state } = await App().load(Calculator, "test");
    expect(state).toEqual({ result: 0 });
  });
});
