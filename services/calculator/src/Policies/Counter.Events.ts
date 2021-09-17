import { CalculatorEvents } from "../Aggregates/Calculator.Events";

export type CounterEvents = Pick<
  CalculatorEvents,
  "DigitPressed" | "DotPressed"
>;
