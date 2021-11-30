import { Digits, Operators } from "./calculator.models";

export type Events = {
  DigitPressed: { digit: Digits };
  OperatorPressed: { operator: Operators };
  DotPressed: undefined;
  EqualsPressed: undefined;
  Cleared: undefined;
  Ignored1: undefined;
  Ignored2: undefined;
  Ignored3: undefined;
  Forgotten: undefined;
};
