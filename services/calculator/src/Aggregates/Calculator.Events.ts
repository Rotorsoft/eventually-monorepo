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
  DigitPressed: { digit: Digits };
  OperatorPressed: { operator: Operators };
  DotPressed: undefined;
  EqualsPressed: undefined;
  Cleared: undefined;
};

// Event handlers receive committed events with id and version - required
export const CalculatorEventsFactory: MessageFactory<CalculatorEvents> = {
  DigitPressed: (data: { digit: Digits }) => ({
    name: "DigitPressed",
    data,
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

  OperatorPressed: (data: { operator: Operators }) => ({
    name: "OperatorPressed",
    data,
    schema: () => OperatorPressedSchema
  }),

  Cleared: () => ({
    name: "Cleared",
    schema: () => ClearedSchema
  })
};
