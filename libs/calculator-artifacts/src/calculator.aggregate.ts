import { AggregateFactory, bind, emit, ZodEmpty } from "@rotorsoft/eventually";
import { z } from "zod";
import * as schemas from "./calculator.schemas";

const round2 = (n: number): number => Math.round(n * 100) / 100;
const Operations = {
  ["+"]: (l: number, r: number): number => round2(l + r),
  ["-"]: (l: number, r: number): number => round2(l - r),
  ["*"]: (l: number, r: number): number => round2(l * r),
  ["/"]: (l: number, r: number): number => round2(l / r)
};

export type CalculatorModel = z.infer<typeof schemas.CalculatorSchema>;

const append = (
  { operator, left, right }: CalculatorModel,
  key: schemas.Digits | "."
): Partial<CalculatorModel> =>
  operator
    ? {
        right: (right || "").concat(key)
      }
    : { left: (left || "").concat(key) };

const compute = (
  model: CalculatorModel,
  operator?: schemas.Operators
): Partial<CalculatorModel> => {
  if (model.operator && model.left && model.right) {
    const l = Number.parseFloat(model.left);
    const r = Number.parseFloat(model.right);
    const result = Operations[model.operator](l, r);
    const left = result.toString();
    return { result, left, right: undefined, operator };
  }
  if (model.left && model.left !== "-") return { operator };
  if (operator === "-") return { left: "-" };
  return {};
};

export const Calculator: AggregateFactory<
  CalculatorModel,
  schemas.CalculatorCommands,
  schemas.CalculatorEvents
> = (stream: string) => ({
  description: "Basic calculator aggregate",
  stream,

  schemas: {
    state: schemas.CalculatorSchema,
    commands: {
      PressKey: schemas.PressKey,
      Reset: ZodEmpty
    },
    events: {
      DigitPressed: schemas.DigitPressed,
      OperatorPressed: schemas.OperatorPressed,
      DotPressed: ZodEmpty,
      EqualsPressed: ZodEmpty,
      Cleared: ZodEmpty,
      Ignored3: ZodEmpty
    }
  },

  init: (): CalculatorModel => ({
    result: 0
  }),

  reduce: {
    DigitPressed: (model, { data }) => append(model, data.digit),
    OperatorPressed: (model, { data }) => compute(model, data.operator),
    DotPressed: (model) => append(model, "."),
    EqualsPressed: (model) => compute(model),
    Cleared: () => ({
      result: 0,
      left: undefined,
      right: undefined,
      operator: undefined
    }),
    Ignored3: () => ({})
  },
  on: {
    PressKey: async ({ key }, state) => {
      if (key === schemas.SYMBOLS[0]) {
        return emit("DotPressed", {});
      }
      if (key === schemas.SYMBOLS[1]) {
        // let's say this is an invalid operation if there is no operator in the model
        if (!state?.operator) throw Error("Don't have an operator!");
        return emit("EqualsPressed", {});
      }
      return schemas.DIGITS.includes(key as schemas.Digits)
        ? emit("DigitPressed", { digit: key as schemas.Digits })
        : emit("OperatorPressed", { operator: key as schemas.Operators });
    },
    Reset: () =>
      Promise.resolve([
        bind("Cleared", {}),
        bind("Ignored3", {}),
        bind("Cleared", {})
      ])
  }
});
