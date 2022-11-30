import { app } from "@rotorsoft/eventually";
import { Calculator } from "../../../calculator-artifacts/src/calculator.aggregate";

describe("builder errors", () => {
  it("should throw duplicate artifact", () => {
    app().with(Calculator);
    expect(() => app().with(Calculator)).toThrowError(
      'Duplicate artifact "Calculator"'
    );
  });
});
