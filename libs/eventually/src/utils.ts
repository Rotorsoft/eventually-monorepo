import * as crypto from "crypto";
import { z, ZodType } from "zod";
import { validate } from "./schema";
import { Actor, Command, Message, Messages } from "./types/messages";

/** Empty messsage payload */
export type Empty = Record<string, never>;
/** Empty message payload schema */
export const ZodEmpty = z.record(z.never());

/**
 * Binds message arguments
 * @param name Message name
 * @param data Message payload
 * @param id Optional aggregate id when binding commands
 * @param expectedVersion Optional aggregate expected version when binding commands
 * @param actor Optional actor when binding external commands
 * @returns The bound message
 */
export const bind = <M extends Messages>(
  name: keyof M & string,
  data: Readonly<M[keyof M & string]>,
  id?: string,
  expectedVersion?: number,
  actor?: Actor
): Message<M> | Command<M> => ({
  name,
  data,
  id,
  expectedVersion,
  actor
});

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
 * Normalizes reducible paths
 * @param name reducible artifact name
 * @returns the reducible path
 */
export const reduciblePath = (name: string): string =>
  "/".concat(decamelize(name), "/:id");

/**
 * Normalizes command handler paths
 * @param name handler name
 * @param reducible flag reducible
 * @param command command name
 * @returns normalized path
 */
export const commandHandlerPath = (
  name: string,
  reducible: boolean,
  command: string
): string =>
  "/".concat(decamelize(name), reducible ? "/:id/" : "/", decamelize(command));

/**
 * Normalizes event handler paths
 * @param name handler name
 * @returns normalized path
 */
export const eventHandlerPath = (name: string): string =>
  "/".concat(decamelize(name));
