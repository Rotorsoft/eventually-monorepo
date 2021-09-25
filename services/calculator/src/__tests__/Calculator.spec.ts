import { App, test_command } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";

describe("calculator", () => {
  const app = App();
  app.withAggregate(Calculator, commands);

  it("should compute correctly", async () => {
    const c = Calculator("test");
    await test_command(c, commands.PressKey({ key: "1" }));
    await test_command(c, commands.PressKey({ key: "+" }));
    await test_command(c, commands.PressKey({ key: "2" }));
    await test_command(c, commands.PressKey({ key: "." }));
    await test_command(c, commands.PressKey({ key: "3" }));
    await test_command(c, commands.PressKey({ key: "=" }));

    const { state } = await app.load(c);
    expect(state).toEqual({
      left: "3.3",
      operator: "+",
      result: 3.3
    });
  });
});
