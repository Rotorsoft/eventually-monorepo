import { App, Test } from "@rotorsoft/eventually";
import { Calculator } from "../Aggregates/Calculator";
import { CalculatorCommandsFactory } from "../Aggregates/Calculator.Commands";

describe("calculator", () => {
  const app = App();
  app.use(Calculator, CalculatorCommandsFactory);

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
