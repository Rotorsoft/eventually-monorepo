import * as crypto from "crypto";
import { ZodError, ZodType } from "zod";
import { app } from "./ports";
import {
  Command,
  CommandTarget,
  Message,
  Messages,
  RegistrationError,
  State,
  ValidationError,
  ZodEmpty
} from "./types";

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
 * Binds message arguments
 * @param name the message name
 * @param data the message payload
 * @param target optional command target args
 * @returns The bound message
 */
export const bind = <M extends Messages>(
  name: keyof M,
  data: Readonly<M[keyof M]>,
  target?: CommandTarget
): Message<M> | Command<M> =>
  ({ name, data, ...target }) as Message<M> | Command<M>;

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

/**
 * Date reviver when parsing JSON strings with the following formats:
 * - YYYY-MM-DDTHH:MM:SS.sssZ
 * - YYYY-MM-DDTHH:MM:SS.sss+HH:MM
 * - YYYY-MM-DDTHH:MM:SS.sss-HH:MM
 */
const ISO_8601 =
  /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d+)?(Z|[+-][0-2][0-9]:[0-5][0-9])?$/;
export const dateReviver = (key: string, value: string): string | Date => {
  if (typeof value === "string" && ISO_8601.test(value)) {
    try {
      return new Date(value);
    } catch {
      return value;
    }
  }
  return value;
};

/** These objects are copied instead of deep merged */
const UNMERGEABLES = [
  RegExp,
  Date,
  Array,
  Map,
  Set,
  WeakMap,
  WeakSet,
  ArrayBuffer,
  SharedArrayBuffer,
  DataView,
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array
];

const mergeable = (value: any): boolean =>
  !!value &&
  typeof value === "object" &&
  !UNMERGEABLES.some((t) => value instanceof t);

/**
 * Clones state with patches recursively. Keys with `undefined` values in patch are deleted.
 * @param state original state
 * @param patch patches to merge
 * @returns a new patched state
 */
export const clone = <S extends State>(
  state: Readonly<S>,
  patch: Readonly<Partial<S>> | undefined
): Readonly<S> => {
  const cloned: State = {};
  Object.keys({ ...state, ...patch }).forEach((key) => {
    const patched = patch && key in patch;
    const deleted = patched && patch[key] === "undefined";
    const value = patched && !deleted ? patch[key] : state[key];
    if (mergeable(value))
      cloned[key] = clone(state[key] || {}, patch && patch[key]);
    else if (!deleted) cloned[key] = value;
  });
  return cloned as Readonly<S>;
};
