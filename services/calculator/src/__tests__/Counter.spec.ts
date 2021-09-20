import { App, Test } from "@rotorsoft/eventually";
import { Calculator } from "../Aggregates/Calculator";
import { CalculatorCommandsFactory } from "../Aggregates/Calculator.Commands";
//import { CalculatorEventsFactory } from "../Aggregates/Calculator.Events";
//import { Counter } from "../Policies/Counter";

describe("Counter", () => {
  const app = App();
  void app.use(Calculator, CalculatorCommandsFactory);
  //void app.routePolicy(Counter, CalculatorEventsFactory);

  it("should return Reset on DigitPressed", async () => {
    const c = Calculator("test");
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "1" }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "1" }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "2" }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "." }));
    await Test.command(c, CalculatorCommandsFactory.PressKey({ key: "3" }));

    expect(await App().load(c)).toEqual({ result: 0 });
  });
});
