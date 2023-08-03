import { app } from "@andela-technology/eventually";
import { Calculator } from "../calculator.aggregate";
import { Counter } from "../counter.policy";

describe("builder errors", () => {
  it("should throw duplicate command handler", () => {
    app().withAggregate(Calculator);
    expect(() => app().withAggregate(Calculator)).toThrowError(
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
