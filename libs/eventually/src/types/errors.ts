import joi from "joi";
import { Message, Payload } from "../types";
import { Errors } from "../types/enums";

export class ValidationError extends Error {
  public readonly details;
  constructor(errors: joi.ValidationError, message?: Message<string, Payload>) {
    super(Errors.ValidationError);
    this.details = {
      errors: errors.details.flatMap((item) => item.message),
      message
    };
  }
}

export class ConcurrencyError extends Error {
  constructor(
    public readonly lastVersion: number,
    public readonly events: Message<string, Payload>[],
    public readonly expectedVersion: number
  ) {
    super(Errors.ConcurrencyError);
  }
}

export class RegistrationError extends Error {
  public readonly details;
  constructor(message: Message<string, Payload>) {
    super(Errors.RegistrationError);
    this.details = `Message [${message.name}] not registered with app builder!`;
  }
}
