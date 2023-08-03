import { bind, CommandAdapter } from "@andela-technology/eventually";
import joi from "joi";
import { Commands } from "./calculator.commands";
import { DIGITS, Keys, OPERATORS, SYMBOLS } from "./calculator.models";

export type ExternalPayload = { id: string; key: Keys };

export const PressKeyAdapter = (): CommandAdapter<
  ExternalPayload,
  Pick<Commands, "PressKey">
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
