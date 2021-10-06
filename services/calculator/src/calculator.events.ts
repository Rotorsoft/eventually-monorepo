import { MessageFactory } from "@rotorsoft/eventually";
import * as schemas from "./calculator.schemas";
import { Digits, Operators } from "./calculator.models";

export type Events = {
  DigitPressed: { digit: Digits };
  OperatorPressed: { operator: Operators };
  DotPressed: undefined;
  EqualsPressed: undefined;
  Cleared: undefined;
};

export const events: MessageFactory<Events> = {
  DigitPressed: (data: { digit: Digits }) => ({
    name: "DigitPressed",
    data,
    schema: () => schemas.DigitPressed
  }),

  DotPressed: () => ({
    name: "DotPressed",
    schema: () => schemas.DotPressed
  }),

  EqualsPressed: () => ({
    name: "EqualsPressed",
    schema: () => schemas.EqualsPressed
  }),

  OperatorPressed: (data: { operator: Operators }) => ({
    name: "OperatorPressed",
    data,
    schema: () => schemas.OperatorPressed
  }),

  Cleared: () => ({
    name: "Cleared",
    schema: () => schemas.Cleared
  })
};
