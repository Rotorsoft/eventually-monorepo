export const DIGITS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9"
] as const;
export const OPERATORS = ["+", "-", "*", "/"] as const;
export const SYMBOLS = [".", "="] as const;
export type Digits = typeof DIGITS[number];
export type Operators = typeof OPERATORS[number];
export type Symbols = typeof SYMBOLS[number];
export type Keys = Digits | Operators | Symbols;

export type CalculatorModel = {
  readonly left?: string;
  readonly right?: string;
  readonly operator?: Operators;
  readonly result: number;
};

export type CounterState = {
  readonly count: number;
};
