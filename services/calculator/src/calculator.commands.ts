import { MessageFactories } from "@rotorsoft/eventually";
import { Keys } from "./calculator.models";
import * as schemas from "./calculator.schemas";

export type Commands = {
  PressKey: { key: Keys };
  Reset: undefined;
  Whatever: undefined;
};

// Aggregate HTTP POST endpoints receiving commands from human actors and brokers (from policies)
export const commands: MessageFactories<Commands> = {
  PressKey: (data: { key: Keys }) => ({
    name: "PressKey",
    data,
    scope: () => "public",
    schema: () => schemas.PressKey
  }),

  Reset: () => ({
    name: "Reset",
    scope: () => "public"
  }),

  Whatever: () => ({
    name: "Whatever",
    scope: () => "private"
  })
};
