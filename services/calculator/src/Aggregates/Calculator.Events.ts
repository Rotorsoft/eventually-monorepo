import { MessageFactory } from "@rotorsoft/eventually";
import {
  ClearedSchema,
  DigitPressedSchema,
  DotPressedSchema,
  EqualsPressedSchema,
  OperatorPressedSchema
} from "../Schemas/Calculator.Schemas";
import { Digits, Operators } from "./Calculator.Model";

export type CalculatorEvents = {
  DigitPressed: Digits;
  OperatorPressed: Operators;
  DotPressed: undefined;
  EqualsPressed: undefined;
  Cleared: undefined;
};

// Event handlers receive committed events with id and version - required
export const CalculatorEventsFactory: MessageFactory<CalculatorEvents> = {
  DigitPressed: (digit?: Digits) => ({
    name: "DigitPressed",
    data: digit,
    schema: () => DigitPressedSchema
  }),

  DotPressed: () => ({
    name: "DotPressed",
    schema: () => DotPressedSchema
  }),

  EqualsPressed: () => ({
    name: "EqualsPressed",
    schema: () => EqualsPressedSchema
  }),

  OperatorPressed: (operator?: Operators) => ({
    name: "OperatorPressed",
    data: operator,
    schema: () => OperatorPressedSchema
  }),

  Cleared: () => ({
    name: "Cleared",
    schema: () => ClearedSchema
  })
};
