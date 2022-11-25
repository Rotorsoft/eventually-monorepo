import { ZodError, ZodType } from "zod";
import { app } from ".";
import { RegistrationError, ValidationError } from "./types/errors";
import { Message, Messages } from "./types/messages";

/**
 * Validates payloads using `zod` schemas
 *
 * @param payload the payload
 * @returns validated payload when schema is provided
 */
export const validate = <T>(payload: T, schema: ZodType<T>): T => {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError)
      throw new ValidationError(
        error.errors.map(({ path, message }) => `${path.join(".")}: ${message}`)
      );
    throw new ValidationError(["zod validation error"]);
  }
};

/**
 * Validates message payloads
 *
 * @param message the message
 * @returns validated message
 */
export const validateMessage = <M extends Messages>(
  message: Message<M>
): Message<M> => {
  const metadata = app().messages[message.name];
  if (!metadata) throw new RegistrationError(message);
  if (metadata.schema) {
    try {
      const validated = validate(message.data, metadata.schema) as Readonly<
        M[keyof M & string]
      >;
      return { name: message.name, data: validated };
    } catch (error) {
      throw new ValidationError(
        (error as ValidationError).details.errors,
        message
      );
    }
  }
  return message;
};
