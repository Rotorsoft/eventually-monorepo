import { MessageFactory } from "@rotorsoft/eventually";
import { Keys } from "./calculator.models";
import * as schemas from "./calculator.schemas";

export type Commands = {
  PressKey: { key: Keys };
  Reset: undefined;
};

// Aggregate HTTP POST endpoints receiving commands from human actors and brokers (from policies)
export const commands: MessageFactory<Commands> = {
  PressKey: (data: { key: Keys }) => ({
    name: "PressKey",
    data,
    schema: () => schemas.PressKey
  }),

  Reset: () => ({
    name: "Reset",
    schema: () => schemas.Reset
  })
};
