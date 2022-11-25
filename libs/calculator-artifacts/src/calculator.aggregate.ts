import { AggregateFactory, bind, ZodEmpty } from "@rotorsoft/eventually";
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

const compute = (model: CalculatorModel): CalculatorModel => {
  if (model.operator && model.left && model.right) {
    const l = Number.parseFloat(model.left);
    const r = Number.parseFloat(model.right);
    const result = Operations[model.operator](l, r);
    const left = result.toString();
    return { result, left, operator: model.operator };
  }
  return model;
};

export const Calculator: AggregateFactory<
  CalculatorModel,
  schemas.CalculatorCommands,
  schemas.CalculatorEvents
> = (id: string) => ({
  description: "Basic calculator aggregate",
  stream: () => `Calculator-${id}`,

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
    DigitPressed: (model, { data }) => {
      if (model.operator) {
        const right = (model.right || "").concat(data.digit || "");
        return { ...model, right };
      }
      const left = (model.left || "").concat(data.digit || "");
      return { ...model, left };
    },

    OperatorPressed: (model, { data }) => {
      if (model.left) {
        const newmodel = compute(model);
        return { ...newmodel, operator: data.operator };
      }
      return { ...model };
    },

    DotPressed: (model) => {
      if (model.operator) {
        const right = (model.right || "").concat(".");
        return { ...model, right };
      }
      const left = (model.left || "").concat(".");
      return { ...model, left };
    },

    EqualsPressed: (model) => compute(model),

    Cleared: () => ({
      result: 0
    }),

    Ignored3: (model) => model
  },
  on: {
    PressKey: async ({ key }, state) => {
      if (key === schemas.SYMBOLS[0]) {
        return Promise.resolve([bind("DotPressed", {})]);
      }
      if (key === schemas.SYMBOLS[1]) {
        // let's say this is an invalid operation if there is no operator in the model
        if (!state?.operator) throw Error("Don't have an operator!");
        return Promise.resolve([bind("EqualsPressed", {})]);
      }
      return schemas.DIGITS.includes(key as schemas.Digits)
        ? [bind("DigitPressed", { digit: key as schemas.Digits })]
        : [bind("OperatorPressed", { operator: key as schemas.Operators })];
    },
    Reset: async () =>
      Promise.resolve([
        bind("Cleared", {}),
        bind("Ignored3", {}),
        bind("Cleared", {})
      ])
  }
});
