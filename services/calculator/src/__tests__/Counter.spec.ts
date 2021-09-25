import { App, test_command } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { Counter } from "../counter.policy";

describe("Counter", () => {
  const app = App();
  app.withAggregate(Calculator, commands);
  app.withPolicy(Counter, events);

  it("should return Reset on DigitPressed", async () => {
    const c = Calculator("test");
    await test_command(c, commands.PressKey({ key: "1" }));
    await test_command(c, commands.PressKey({ key: "1" }));
    await test_command(c, commands.PressKey({ key: "2" }));
    await test_command(c, commands.PressKey({ key: "." }));
    await test_command(c, commands.PressKey({ key: "3" }));

    const { state } = await app.load(c);
    expect(state).toEqual({ result: 0 });
  });
});
