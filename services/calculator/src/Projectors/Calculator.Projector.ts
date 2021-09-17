import { Projector } from "@rotorsoft/eventually";
import { CalculatorEvents } from "../Aggregates/Calculator.Events";

export const CalculatorProjector = (): Projector<CalculatorEvents> => ({
  name: () => "CalculatorProjector",

  onDigitPressed: async () => {
    return Promise.resolve();
  },
  onDotPressed: async () => {
    return Promise.resolve();
  },
  onEqualsPressed: async () => {
    return Promise.resolve();
  },
  onOperatorPressed: async () => {
    return Promise.resolve();
  },
  onCleared: async () => {
    return Promise.resolve();
  }
});
