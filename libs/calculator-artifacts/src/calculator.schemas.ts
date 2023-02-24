import { Empty } from "@rotorsoft/eventually";
import z from "zod";

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
export type Digits = (typeof DIGITS)[number];
export type Operators = (typeof OPERATORS)[number];
export type Symbols = (typeof SYMBOLS)[number];
export type Keys = Digits | Operators | Symbols;

export const CalculatorSchema = z
  .object({
    left: z.string().optional(),
    right: z.string().optional(),
    operator: z.enum(OPERATORS).optional(),
    result: z.number()
  })
  .describe("Holds the running calculation");

export const CounterState = z
  .object({
    count: z.number()
  })
  .describe("Counts digits and operators");

export const DigitPressed = z
  .object({
    digit: z.enum(DIGITS)
  })
  .describe(
    "Generated when a **digit** is pressed\n\nThis is and example to use\n* markup language\n* inside descriptions"
  );

export const OperatorPressed = z
  .object({
    operator: z.enum(OPERATORS)
  })
  .describe("Generated when operator is pressed");

export const PressKey = z
  .object({
    key: z.enum([...DIGITS, ...OPERATORS, ...SYMBOLS])
  })
  .describe(
    "Invoked when user presses a key - either digit, operator, or symbol"
  );

export enum ComplexEnum {
  one = "one",
  two = "two"
}

export const SubSubComplex = z
  .object({
    arrayFld: z.array(z.string().min(1)),
    enumFld: z.nativeEnum(ComplexEnum)
  })
  .describe("Sample enum");

export const SubComplex = z
  .object({
    stringFld: z.string().min(1),
    anotherObj: z.array(SubSubComplex)
  })
  .describe("Schema composition");

export const Complex = z
  .object({
    dateFld: z.date(),
    numberFld: z.number().optional(),
    boolFld: z.boolean().optional(),
    guidFld: z.string().uuid().optional(),
    objFld: SubComplex
  })
  .describe("This is a complex object");

export type AllCommands = {
  PressKey: z.infer<typeof PressKey>;
  Reset: Empty;
  Whatever: Empty;
  Forget: Empty;
};

export type CalculatorCommands = {
  PressKey: z.infer<typeof PressKey>;
  Reset: Empty;
};

export type CounterCommands = { Reset: Empty };

export type AllEvents = {
  DigitPressed: z.infer<typeof DigitPressed>;
  OperatorPressed: z.infer<typeof OperatorPressed>;
  DotPressed: Empty;
  EqualsPressed: Empty;
  Cleared: Empty;
  Ignored1: Empty;
  Ignored2: Empty;
  Ignored3: Empty;
  Forgotten: Empty;
  Complex: z.infer<typeof Complex>;
};

export type CalculatorEvents = {
  DigitPressed: z.infer<typeof DigitPressed>;
  OperatorPressed: z.infer<typeof OperatorPressed>;
  DotPressed: Empty;
  EqualsPressed: Empty;
  Cleared: Empty;
  Ignored3: Empty;
};

export type CounterEvents = {
  DigitPressed: z.infer<typeof DigitPressed>;
  OperatorPressed: z.infer<typeof OperatorPressed>;
  DotPressed: Empty;
  EqualsPressed: Empty;
};
