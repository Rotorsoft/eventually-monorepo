import { app } from "@rotorsoft/eventually";
import { Calculator } from "../calculator.aggregate";
import { Counter } from "../counter.policy";

describe("builder errors", () => {
  it("should throw duplicate command handler", () => {
    app().withCommandHandlers(Calculator);
    expect(() => app().withCommandHandlers(Calculator)).toThrowError(
      "Duplicate command handler Calculator"
    );
  });

  it("should throw duplicate event handler", () => {
    app().withProcessManager(Counter);
    expect(() => app().withProcessManager(Counter)).toThrowError(
      "Duplicate event handler Counter"
    );
  });
});
