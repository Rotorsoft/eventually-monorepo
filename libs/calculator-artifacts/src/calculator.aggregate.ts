import { Aggregate, bind } from "@andela-technology/eventually";
import { Commands } from "./calculator.commands";
import { Events } from "./calculator.events";
import {
  CalculatorModel,
  DIGITS,
  Digits,
  Operators,
  SYMBOLS
} from "./calculator.models";
import * as schemas from "./calculator.schemas";

const round2 = (n: number): number => Math.round(n * 100) / 100;
const Operations = {
  ["+"]: (l: number, r: number): number => round2(l + r),
  ["-"]: (l: number, r: number): number => round2(l - r),
  ["*"]: (l: number, r: number): number => round2(l * r),
  ["/"]: (l: number, r: number): number => round2(l / r)
};

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

export type CalculatorEvents = Omit<
  Events,
  "Ignored1" | "Ignored2" | "Forgotten" | "Complex"
>;

export const Calculator = (
  id: string
): Aggregate<
  CalculatorModel,
  Omit<Commands, "Whatever" | "Forget">,
  CalculatorEvents
> => ({
  stream: () => `Calculator-${id}`,

  schemas: {
    state: schemas.CalculatorModel,
    PressKey: schemas.PressKey,
    DigitPressed: schemas.DigitPressed,
    OperatorPressed: schemas.OperatorPressed
  },

  init: (): CalculatorModel => ({
    result: 0
  }),

  applyDigitPressed: (model, { data }) => {
    if (model.operator) {
      const right = (model.right || "").concat(data.digit || "");
      return { ...model, right };
    }
    const left = (model.left || "").concat(data.digit || "");
    return { ...model, left };
  },

  applyOperatorPressed: (model, { data }) => {
    if (model.left) {
      const newmodel = compute(model);
      return { ...newmodel, operator: data.operator };
    }
    return { ...model };
  },

  applyDotPressed: (model) => {
    if (model.operator) {
      const right = (model.right || "").concat(".");
      return { ...model, right };
    }
    const left = (model.left || "").concat(".");
    return { ...model, left };
  },

  applyEqualsPressed: (model) => compute(model),

  applyCleared: () => ({
    result: 0
  }),

  applyIgnored3: (model) => model,

  onPressKey: async ({ key }, state) => {
    if (key === SYMBOLS[0]) {
      return Promise.resolve([bind("DotPressed", {})]);
    }
    if (key === SYMBOLS[1]) {
      // let's say this is an invalid operation if there is no operator in the model
      if (!state?.operator) throw Error("Don't have an operator!");
      return Promise.resolve([bind("EqualsPressed", {})]);
    }
    return DIGITS.includes(key as Digits)
      ? [bind("DigitPressed", { digit: key as Digits })]
      : [bind("OperatorPressed", { operator: key as Operators })];
  },

  onReset: async () =>
    Promise.resolve([
      bind("Cleared", {}),
      bind("Ignored3", {}),
      bind("Cleared", {})
    ])
});
