import * as crypto from "crypto";
import { ZodError, ZodType } from "zod";
import { app } from "./ports";
import {
  Command,
  CommandTarget,
  Message,
  Messages,
  RegistrationError,
  ValidationError
} from "./types";

/**
 * Validates payloads using `zod` schemas
 *
 * @param payload the raw payload
 * @param schema the zod schema
 * @returns the validated payload
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
 * Validates message payloads from registered schemas
 *
 * @param message the message
 * @returns validated message
 */
export const validateMessage = <M extends Messages>(
  message: Message<M>
): Message<M> => {
  const metadata = app().messages[message.name];
  if (!metadata) throw new RegistrationError(message);
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
};

/**
 * Binds message arguments
 * @param name the message name
 * @param data the message payload
 * @param target optional command target args
 * @returns The bound message
 */
export const bind = <M extends Messages>(
  name: keyof M & string,
  data: Readonly<M[keyof M & string]>,
  target?: CommandTarget
): Message<M> | Command<M> => ({ name, data, ...target });

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
  source: S,
  schema: ZodType<S>,
  target?: T
): S & T => {
  const value = validate(source, schema);
  return Object.assign(target || {}, value) as S & T;
};

/**
 * Camelizes string
 * @param value decamelized string
 * @returns camelized string
 */
export const camelize = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

/**
 * Decamelizes string
 * @param value camelized string
 * @returns decamelized string
 */
export const decamelize = (value: string): string =>
  value
    .replace(/([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu, "$1-$2")
    .replace(
      /(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
      "$1-$2"
    )
    .toLowerCase();

/**
 * Generates a random id
 * @returns random id
 */
const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const ID_SIZE = 24;
const cryptoBuffer = Buffer.allocUnsafe(ID_SIZE * 128);
export const randomId = (): string => {
  crypto.randomFillSync(cryptoBuffer);
  let id = "";
  for (let i = 0; i < ID_SIZE; i++) id += ALPHABET[cryptoBuffer[i] & 63];
  return id;
};

const HOUR_SECS = 60 * 60;
const DAY_SECS = 24 * HOUR_SECS;
/** Formats seconds into elapsed time string */
export const formatTime = (seconds: number): string => {
  const iso = new Date(seconds * 1000).toISOString();
  if (seconds < HOUR_SECS) return iso.substring(14, 19);
  if (seconds < DAY_SECS) return iso.substring(11, 19);
  return `${Math.round(seconds / DAY_SECS)} days ${iso.substring(11, 19)}`;
};

/**
 * Promisify setTimeout
 * @param millis the millis to sleep
 */
export const sleep = (millis: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, millis));
