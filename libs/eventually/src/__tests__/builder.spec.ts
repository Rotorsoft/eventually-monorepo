import { app } from "@rotorsoft/eventually";
import { Calculator } from "../../../calculator-artifacts/src/calculator.aggregate";
import { Builder } from "../builder";

describe("builder errors", () => {
  it("should throw duplicate artifact", () => {
    const builder = app() as unknown as Builder;
    builder.with(Calculator);
    expect(() => builder.with(Calculator)).toThrowError(
      'Duplicate artifact "Calculator"'
    );
  });
});
