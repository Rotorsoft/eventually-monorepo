import {
  Calculator,
  CalculatorEvents,
  CalculatorModel,
  Keys
} from "@rotorsoft/calculator-artifacts";
import { Client, Snapshot } from "@rotorsoft/eventually";

export const pressKey = (
  http: Client,
  id: string,
  key: Keys
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command(Calculator, "PressKey", { key }, { id });

export const reset = (
  http: Client,
  id: string
): Promise<Snapshot<CalculatorModel, CalculatorEvents>[]> =>
  http.command(Calculator, "Reset", {}, { id });
