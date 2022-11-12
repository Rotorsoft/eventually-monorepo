import { app } from ".";
import {
  Message,
  Messages,
  Payload,
  RegistrationError,
  ValidationError
} from "./types";
import { Schema } from "./types/schemas";

/**
 * Validates payloads
 *
 * @param payload the payload
 * @returns validated payload when schema is provided
 */
export const validate = <T extends Payload>(
  payload: T,
  schema: Schema<T>
): T => {
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    allowUnknown: true
  });
  if (error)
    throw new ValidationError(
      error.details.flatMap((detail) => detail.message)
    );
  return value;
};

/**
 * Extends target payload with source payload after validating source
 *
 * @param source the source payload
 * @param schema the source schema
 * @param target the target payload
 * @returns the extended payload
 */
export const extend = <S extends Payload, T extends Payload>(
  source: S,
  schema: Schema<S>,
  target?: T
): S & T => {
  const value = validate(source, schema);
  return Object.assign(target || {}, value) as S & T;
};

/**
 * Validates messages
 *
 * @param message the message
 * @returns validated message when schema is provided
 */
export const validateMessage = <T extends Messages>(
  message: Message<T>
): Message<T> => {
  const metadata = app().messages[message.name];
  if (!metadata) throw new RegistrationError(message);
  if (metadata.schema) {
    try {
      const data = validate(message.data, metadata.schema);
      return { name: message.name, data };
    } catch (error) {
      throw new ValidationError(
        (error as ValidationError).details.errors,
        message
      );
    }
  }
  return message;
};
