import { MessageFactories } from "@rotorsoft/eventually";
import * as schemas from "./calculator.schemas";
import { Digits, Operators } from "./calculator.models";

export type Events = {
  DigitPressed: { digit: Digits };
  OperatorPressed: { operator: Operators };
  DotPressed: undefined;
  EqualsPressed: undefined;
  Cleared: undefined;
};

export const events: MessageFactories<Events> = {
  DigitPressed: (data: { digit: Digits }) => ({
    name: "DigitPressed",
    data,
    scope: () => "public",
    schema: () => schemas.DigitPressed
  }),

  DotPressed: () => ({
    name: "DotPressed",
    scope: () => "public"
  }),

  EqualsPressed: () => ({
    name: "EqualsPressed",
    scope: () => "public"
  }),

  OperatorPressed: (data: { operator: Operators }) => ({
    name: "OperatorPressed",
    data,
    scope: () => "private",
    schema: () => schemas.OperatorPressed
  }),

  Cleared: () => ({
    name: "Cleared",
    scope: () => "public"
  })
};
