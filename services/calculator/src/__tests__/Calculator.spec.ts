import { App, test_command } from "@rotorsoft/eventually";
import { Calculator } from "../Aggregates/Calculator";
import { CalculatorCommandsFactory } from "../Aggregates/Calculator.Commands";

describe("calculator", () => {
  const app = App();
  app.withAggregate(Calculator, CalculatorCommandsFactory);

  it("should compute correctly", async () => {
    const c = Calculator("test");
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "1" }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "+" }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "2" }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "." }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "3" }));
    await test_command(c, CalculatorCommandsFactory.PressKey({ key: "=" }));

    const { state } = await app.load(c);
    expect(state).toEqual({
      left: "3.3",
      operator: "+",
      result: 3.3
    });
  });
});
