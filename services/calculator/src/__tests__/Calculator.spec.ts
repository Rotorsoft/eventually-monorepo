import { App } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";

describe("calculator", () => {
  const app = App()
    .withEvents(events)
    .withCommands(commands)
    .withAggregate(Calculator);

  beforeAll(async () => {
    app.build();
    await app.listen();
  });

  it("should compute correctly", async () => {
    await app.command(Calculator, "test", commands.PressKey({ key: "1" }));
    await app.command(Calculator, "test", commands.PressKey({ key: "+" }));
    await app.command(Calculator, "test", commands.PressKey({ key: "2" }));
    await app.command(Calculator, "test", commands.PressKey({ key: "." }));
    await app.command(Calculator, "test", commands.PressKey({ key: "3" }));
    await app.command(Calculator, "test", commands.PressKey({ key: "=" }));

    const { state } = await App().load(Calculator, "test");
    expect(state).toEqual({
      left: "3.3",
      operator: "+",
      result: 3.3
    });
  });
});
