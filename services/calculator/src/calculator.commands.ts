import { MessageFactories, Scopes } from "@rotorsoft/eventually";
import { Keys } from "./calculator.models";
import * as schemas from "./calculator.schemas";

export type Commands = {
  PressKey: { key: Keys };
  Reset: undefined;
  Whatever: undefined;
};

// Aggregate HTTP POST endpoints receiving commands from human actors and brokers (from policies)
export const commands: MessageFactories<Commands> = {
  PressKey: () => ({
    scope: Scopes.public,
    schema: schemas.PressKey
  }),

  Reset: () => ({
    scope: Scopes.public
  }),

  Whatever: () => ({})
};
