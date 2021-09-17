import { Aggregate, CommittedEvent } from "@rotorsoft/eventually";
import {
  DIGITS,
  SYMBOLS,
  Digits,
  CalculatorModel,
  Operators
} from "./Calculator.Model";
import { CalculatorCommands } from "./Calculator.Commands";
import { CalculatorEvents, CalculatorEventsFactory } from "./Calculator.Events";

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
): Aggregate<CalculatorModel, CalculatorCommands, CalculatorEvents> => ({
  id,

  name: () => "Calculator",

  // Model Reducer with event side effects
  init: (): CalculatorModel => ({
    result: 0
  }),

  applyDigitPressed: (
    model: CalculatorModel,
    event: CommittedEvent<"DigitPressed", Digits>
  ) => {
    if (model.operator) {
      const right = (model.right || "").concat(event.data || "");
      return { ...model, right };
    }
    const left = (model.left || "").concat(event.data || "");
    return { ...model, left };
  },

  applyOperatorPressed: (
    model: CalculatorModel,
    event: CommittedEvent<"OperatorPressed", Operators>
  ) => {
    if (model.left) {
      const newmodel = compute(model);
      return { ...newmodel, operator: event.data };
    }
    return { ...model };
  },

  applyDotPressed: (model: CalculatorModel) => {
    if (model.operator) {
      const right = (model.right || "").concat(".");
      return { ...model, right };
    }
    const left = (model.left || "").concat(".");
    return { ...model, left };
  },

  applyEqualsPressed: (model: CalculatorModel) => compute(model),

  applyCleared: () => ({
    result: 0
  }),

  // Command Handlers validate business rules and poduce events
  // eslint-disable-next-line
  onPressKey: async (model, key) => {
    if (key === SYMBOLS[0]) return CalculatorEventsFactory.DotPressed();
    if (key === SYMBOLS[1]) return CalculatorEventsFactory.EqualsPressed();
    if (DIGITS.includes(key as Digits))
      return CalculatorEventsFactory.DigitPressed(key as Digits);
    return CalculatorEventsFactory.OperatorPressed(key as Operators);
  },

  // eslint-disable-next-line
  onReset: async () => CalculatorEventsFactory.Cleared()
});
