import { app } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { commands } from "../calculator.commands";
import { events } from "../calculator.events";
import { Counter } from "../counter.policy";

describe("builder errors", () => {
  it("should throw duplicate command", () => {
    app().withCommands(commands);
    expect(() => app().withCommands(commands)).toThrowError(
      "Duplicate command PressKey"
    );
  });

  it("should throw duplicate event", () => {
    app().withEvents(events);
    expect(() => app().withEvents(events)).toThrowError(
      "Duplicate event DigitPressed"
    );
  });

  it("should throw duplicate command handler", () => {
    app().withCommandHandlers(Calculator);
    expect(() => app().withCommandHandlers(Calculator)).toThrowError(
      "Duplicate command handler Calculator"
    );
  });

  it("should throw duplicate event handler", () => {
    app().withEventHandlers(Counter);
    expect(() => app().withEventHandlers(Counter)).toThrowError(
      "Duplicate event handler Counter"
    );
  });
});
