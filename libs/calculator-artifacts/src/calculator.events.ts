import { Payload } from "@rotorsoft/eventually";
import { Digits, Operators, Complex } from "./calculator.models";

export type Events = {
  DigitPressed: { digit: Digits };
  OperatorPressed: { operator: Operators };
  DotPressed: Payload;
  EqualsPressed: Payload;
  Cleared: Payload;
  Ignored1: Payload;
  Ignored2: Payload;
  Ignored3: Payload;
  Forgotten: Payload;
  Complex: Complex;
};
