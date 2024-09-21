import { z, ZodError, type ZodType } from "zod";
import { app } from "../ports";
import {
  RegistrationError,
  ValidationError,
  type Message,
  type Messages
} from "../types";

/** Empty message payload schema */
export const ZodEmpty = z.record(z.never());

/**
 * Validates payloads using `zod` schemas
 *
 * @param payload the raw payload
 * @param schema the zod schema
 * @returns the validated payload
 */
export const validate = <T>(
  payload: Readonly<T>,
  schema: ZodType<T>
): Readonly<T> => {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      const issues = (error as ZodError).issues.map(
        ({ path, message }) => `${path.join(".")}: ${message}`
      );
      throw new ValidationError(issues);
    }
    throw new ValidationError(["zod validation error"]);
  }
};

/**
 * Validates message payloads from registered schemas
 *
 * @param message the message
 * @returns validated message
 */
export const validateMessage = <M extends Messages>(
  message: Message<M>
): Message<M> => {
  const metadata = app().messages.get(message.name);
  if (!metadata) throw new RegistrationError(message);
  if (!message.data && metadata.schema === ZodEmpty) return message;
  try {
    const data = validate<M[keyof M & string]>(
      message.data,
      metadata.schema as ZodType<M[keyof M & string]>
    );
    return { name: message.name, data };
  } catch (error) {
    throw new ValidationError(
      (error as ValidationError).details.errors,
      message
    );
  }
};

/**
 * Extends target payload with source payload after validating source
 *
 * @param source the source payload
 * @param schema the source schema
 * @param target the target payload
 * @returns the extended payload
 */
export const extend = <
  S extends Record<string, unknown>,
  T extends Record<string, unknown>
>(
  source: Readonly<S>,
  schema: ZodType<S>,
  target?: Readonly<T>
): Readonly<S & T> => {
  const value = validate(source, schema);
  return Object.assign(target || {}, value) as Readonly<S & T>;
};
