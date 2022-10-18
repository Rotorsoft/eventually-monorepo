import { bind, CommandAdapter } from "@rotorsoft/eventually";
import joi from "joi";
import { Commands } from "./calculator.commands";
import { DIGITS, Keys, OPERATORS, SYMBOLS } from "./calculator.models";

export type ExternalPayload = { id: string; key: Keys };

export const PressKeyAdapter = (): CommandAdapter<
  Pick<Commands, "PressKey">,
  ExternalPayload
> => ({
  adapt: ({ id, key }) => bind("PressKey", { key }, id),
  schema: joi.object<ExternalPayload>({
    id: joi.string().required(),
    key: joi
      .string()
      .required()
      .min(1)
      .max(1)
      .valid(...DIGITS, ...OPERATORS, ...SYMBOLS)
  })
});
