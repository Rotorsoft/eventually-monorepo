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

export const DigitPressed = joi
  .object({
    digit: joi
      .string()
      .required()
      .valid(...models.DIGITS)
  })
  .required();
export const OperatorPressed = joi
  .object({
    operator: joi
      .string()
      .required()
      .valid(...models.OPERATORS)
  })
  .required();
export const PressKey = joi
  .object({
    key: joi
      .string()
      .required()
      .min(1)
      .max(1)
      .valid(...models.DIGITS, ...models.OPERATORS, ...models.SYMBOLS)
  })
  .required();
