import { Aggregate, bind } from "@rotorsoft/eventually";
import { PostgresSnapshotStore } from "@rotorsoft/eventually-pg";
import { Commands } from "./calculator.commands";
import { Events, events } from "./calculator.events";
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

export const Calculator = (
  id: string
): Aggregate<CalculatorModel, Omit<Commands, "Whatever">, Events> => ({
  snapshot: {
    factory: PostgresSnapshotStore,
    threshold: 2
  },
  stream: () => `Calculator${id}`,

  schema: () => schemas.CalculatorModel,

  init: (): CalculatorModel => ({
    result: 0
  }),

  applyDigitPressed: (model, event) => {
    if (model.operator) {
      const right = (model.right || "").concat(event.data.digit);
      return { ...model, right };
    }
    const left = (model.left || "").concat(event.data.digit);
    return { ...model, left };
  },

  applyOperatorPressed: (model, event) => {
    if (model.left) {
      const newmodel = compute(model);
      return { ...newmodel, operator: event.data.operator };
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

  onPressKey: async (data, state) => {
    if (data.key === SYMBOLS[0]) {
      return Promise.resolve([bind(events.DotPressed)]);
    }
    if (data.key === SYMBOLS[1]) {
      // let's say this is an invalid operation if there is no operator in the model
      if (!state.operator) throw Error("Don't have an operator!");
      return Promise.resolve([bind(events.EqualsPressed)]);
    }
    return DIGITS.includes(data.key as Digits)
      ? [bind(events.DigitPressed, { digit: data.key as Digits })]
      : [bind(events.OperatorPressed, { operator: data.key as Operators })];
  },

  onReset: async () => Promise.resolve([bind(events.Cleared)])
});
