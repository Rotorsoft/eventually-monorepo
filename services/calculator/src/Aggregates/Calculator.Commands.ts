import { MessageFactory } from "@rotorsoft/eventually";
import { Keys } from "./Calculator.Model";
import { PressKeySchema, ResetSchema } from "../Schemas/Calculator.Schemas";

export type CalculatorCommands = {
  PressKey: Keys;
  Reset: undefined;
};

// Aggregate HTTP POST endpoints receiving commands from human actors and brokers (from policies)
export const CalculatorCommandsFactory: MessageFactory<CalculatorCommands> = {
  PressKey: (key?: Keys) => ({
    name: "PressKey",
    data: key,
    schema: () => PressKeySchema
  }),

  Reset: () => ({
    name: "Reset",
    schema: () => ResetSchema
  })
};
