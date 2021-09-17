import * as joi from "joi";
import { DIGITS, OPERATORS, SYMBOLS } from "../Aggregates/Calculator.Model";

export const DigitPressedSchema = joi.object({
  id: joi.string().required(),
  version: joi.number().required(),
  name: joi.string().required().valid("DigitPressed"),
  data: joi
    .string()
    .required()
    .valid(...DIGITS)
});
export const DotPressedSchema = joi.object({
  id: joi.string().required(),
  version: joi.number().required(),
  name: joi.string().required().valid("DotPressed")
});

export const EqualsPressedSchema = joi.object({
  id: joi.string().required(),
  version: joi.number().required(),
  name: joi.string().required().valid("EqualsPressed")
});

export const OperatorPressedSchema = joi.object({
  id: joi.string().required(),
  version: joi.number().required(),
  name: joi.string().required().valid("OperatorPressed"),
  data: joi
    .string()
    .required()
    .valid(...OPERATORS)
});

export const ClearedSchema = joi.object({
  id: joi.string().required(),
  version: joi.number().required(),
  name: joi.string().required().valid("Cleared")
});

export const PressKeySchema = joi.object({
  name: joi.string().required().valid("PressKey"),
  data: joi
    .string()
    .required()
    .min(1)
    .max(1)
    .valid(...DIGITS, ...OPERATORS, ...SYMBOLS)
});

export const ResetSchema = joi.object({
  name: joi.string().required().valid("Reset")
});
