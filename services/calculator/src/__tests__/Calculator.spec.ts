import { App, Test } from "@rotorsoft/eventually";
import { Calculator } from "../Aggregates/Calculator";
import { CalculatorCommandsFactory } from "../Aggregates/Calculator.Commands";
import { CalculatorEventsFactory } from "../Aggregates/Calculator.Events";
import { Counter } from "../Policies/Counter";

describe("calculator", () => {
  const app = App();
  void app.routeAggregate(Calculator, CalculatorCommandsFactory);
  void app.routePolicy(Counter, CalculatorEventsFactory);

  it("should compute correctly", async () => {
    const c = Calculator("test");
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "1" }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "+" }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "2" }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "." }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "3" }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "=" }));

    expect(await App().load(c)).toEqual({
      left: "3.3",
      operator: "+",
      result: 3.3
    });
  });
});
