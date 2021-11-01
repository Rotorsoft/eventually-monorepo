import * as joi from "joi";
import * as models from "./calculator.models";

export const CalculatorModel = joi.object<models.CalculatorModel>({
  left: joi.string(),
  right: joi.string(),
  operator: joi.string().valid(...models.OPERATORS),
  result: joi.number().required()
});

export const CounterState = joi.object<models.CounterState>({
  count: joi.number().required()
});

export const DigitPressed = joi.object({
  name: joi.string().required().valid("DigitPressed"),
  data: joi
    .object({
      digit: joi
        .string()
        .required()
        .valid(...models.DIGITS)
    })
    .required()
});
export const DotPressed = joi.object({
  name: joi.string().required().valid("DotPressed")
});

export const EqualsPressed = joi.object({
  name: joi.string().required().valid("EqualsPressed")
});

export const OperatorPressed = joi.object({
  name: joi.string().required().valid("OperatorPressed"),
  data: joi
    .object({
      operator: joi
        .string()
        .required()
        .valid(...models.OPERATORS)
    })
    .required()
});

export const Cleared = joi.object({
  name: joi.string().required().valid("Cleared")
});

export const PressKey = joi.object({
  name: joi.string().required().valid("PressKey"),
  data: joi
    .object({
      key: joi
        .string()
        .required()
        .min(1)
        .max(1)
        .valid(...models.DIGITS, ...models.OPERATORS, ...models.SYMBOLS)
    })
    .required()
});

export const Reset = joi.object({
  name: joi.string().required().valid("Reset")
});

export const Whatever = joi.object({
  name: joi.string().required().valid("Whatever")
});
