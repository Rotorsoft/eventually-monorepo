import { App, test_command } from "@rotorsoft/eventually";
import { Calculator } from "../Aggregates/Calculator";
import { CalculatorCommandsFactory } from "../Aggregates/Calculator.Commands";
import { CalculatorEventsFactory } from "../Aggregates/Calculator.Events";
import { Counter } from "../Policies/Counter";

describe("Counter", () => {
  const app = App();
  app.withAggregate(Calculator, CalculatorCommandsFactory);
  app.withPolicy(Counter, CalculatorEventsFactory);

  it("should return Reset on DigitPressed", async () => {
    const c = Calculator("test");
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "1" }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "1" }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "2" }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "." }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "3" }));

    const model = await app.load(c);
    console.log(model);
    expect(model).toEqual({ result: 0 });
  });
});
