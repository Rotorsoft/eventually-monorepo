import z, { ZodError, type ZodType } from "zod";
import { app, store } from "./ports";
import {
  RegistrationError,
  ValidationError,
  type Condition,
  type Message,
  type Messages,
  type Operator,
  type Patch,
  type State
} from "./types";

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
 * Binds message arguments
 * @param name the message name
 * @param data the message payload
 * @returns The bound message
 */
export const bind = <M extends Messages, N extends keyof M & string>(
  name: N,
  data: Readonly<M[N]>
): Message<M> => ({ name, data });

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
 * Function debouncer
 */
type DF = (this: ThisParameterType<void>, ...args: any[]) => void;
export const debounce = (func: DF, delay: number): DF => {
  let timeout: NodeJS.Timeout;
  return function (this: ThisParameterType<void>, ...args: any[]): void {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

/**
 * Function throttler
 */
export const throttle = <T extends (...args: unknown[]) => ReturnType<T>>(
  func: T,
  delay: number
): ((this: ThisParameterType<T>, ...args: Parameters<T>) => void) => {
  let last = 0;
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - last >= delay) {
      func.apply(this, args);
      last = now;
    }
  };
};

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
 * Copies state with patches recursively. Keys with `undefined` or `null` values in patch are deleted.
 * @param prev original state
 * @param curr patches to merge
 * @returns a new patched state
 */
export const patch = <S extends State>(
  prev: Readonly<S | Patch<S>>,
  curr: Readonly<Patch<S>>
): Readonly<S | Patch<S>> => {
  const copy: State = {};
  Object.keys({ ...prev, ...curr }).forEach((key) => {
    const patched = !!curr && key in curr;
    const deleted =
      patched && (typeof curr[key] === "undefined" || curr[key] === null);
    const value = patched && !deleted ? curr[key] : prev[key];
    if (!deleted) {
      if (mergeable(value))
        copy[key] = patch(prev[key] || {}, curr && curr[key]);
      else copy[key] = value;
    }
  });
  return copy as S;
};

/**
 * Seeds registered stores
 */
export const seed = async (): Promise<void> => {
  await store().seed();
  for (const [, artifact] of app().artifacts) {
    if (artifact.type === "projector" && artifact.projector)
      await artifact.projector.store.seed(
        artifact.projector.schema,
        artifact.projector.indexes
      );
  }
};

/**
 * Decodes projector filter conditions
 *
 * @param condition filter condition expressions
 * @returns [operator, value] tuples
 */
export const conditions = <T>(condition: Condition<T>): [Operator, any][] =>
  typeof condition === "object"
    ? (Object.entries(condition) as [Operator, any][])
    : [["eq", condition]];
