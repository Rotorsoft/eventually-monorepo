import * as crypto from "crypto";
import * as joi from "joi";
import { app } from ".";
import { Store } from "./interfaces";
import { singleton } from "./singleton";
import {
  Actor,
  Command,
  CommandHandler,
  CommandHandlerFactory,
  EventHandler,
  EventHandlerFactory,
  Message,
  MessageHandler,
  Payload,
  Reducible,
  ReducibleFactory,
  Streamable
} from "./types";
import { InMemoryStore } from "./__dev__";

export const store = singleton(function store(store?: Store) {
  return store || InMemoryStore();
});

/**
 * Binds message arguments
 * @param name Message name
 * @param data Optional message payload
 * @param id Optional aggregate id when binding commands
 * @param expectedVersion Optional aggregate expected version when binding commands
 * @param actor Optional actor when binding external commands
 * @returns The bound message
 */
export const bind = <Name extends string, Type extends Payload>(
  name: Name,
  data?: Type,
  id?: string,
  expectedVersion?: number,
  actor?: Actor
): Message<Name, Type> | Command<Name, Type> => ({
  name,
  data,
  id,
  expectedVersion,
  actor
});

/**
 * Decamelizes string
 * @param value camel-case string
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

const funcsOf = (prefix: string, object: Record<string, unknown>): string[] => {
  return Object.entries(object)
    .filter(([key, value]) => {
      return typeof value === "function" && key.startsWith(prefix);
    })
    .map(([key]) => key.substring(prefix.length));
};

/**
 * Extracts events from reducible
 * @param reducible the reducible
 * @returns array of event names
 */
export const eventsOf = <M extends Payload, E>(
  reducible: Reducible<M, E>
): string[] => funcsOf("apply", reducible);

/**
 * Extracts messages from handler
 * @param handler The message handler
 * @returns array of message names
 */
export const messagesOf = <M extends Payload, C, E>(
  handler: CommandHandler<M, C, E> | EventHandler<M, C, E>
): string[] => funcsOf("on", handler);

/**
 * Reducible type guard
 * @param handler a message handler
 * @returns a reducible type or undefined
 */
export const getReducible = <M extends Payload, C, E>(
  handler: MessageHandler<M, C, E>
): Reducible<M, E> | undefined =>
  "init" in handler ? (handler as Reducible<M, E>) : undefined;

/**
 * Streamable type guard
 * @param handler a message handler
 * @returns a streamable type or undefined
 */
export const getStreamable = <M extends Payload, C, E>(
  handler: MessageHandler<M, C, E>
): Streamable | undefined =>
  "stream" in handler ? (handler as Streamable) : undefined;

/**
 * Normalizes reducible paths
 * @param reducible reducible factory
 * @returns the reducible path
 */
export const reduciblePath = <M extends Payload, C, E>(
  reducible: ReducibleFactory<M, C, E>
): string => "/".concat(decamelize(reducible.name), "/:id");

/**
 * Normalizes command handler paths
 * @param handler command handler factory
 * @param name command name
 * @returns normalized path
 */
export const commandHandlerPath = <M extends Payload, C, E>(
  handler: CommandHandlerFactory<M, C, E>,
  name: string
): string =>
  "/".concat(
    decamelize(handler.name),
    getReducible(handler(undefined)) ? "/:id/" : "/",
    decamelize(name)
  );

/**
 * Normalizes event handler paths
 * @param handler event handler factory
 * @returns normalized path
 */
export const eventHandlerPath = <M extends Payload, C, E>(
  handler: EventHandlerFactory<M, C, E>
): string => "/".concat(decamelize(handler.name));

export enum Errors {
  ValidationError = "Validation Error",
  ConcurrencyError = "Concurrency Error"
}

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

/**
 * Validates message payloads
 *
 * @param message the message
 * @returns validated payload when schema is provided
 */
export const validateMessage = (
  message: Message<string, Payload>
): Payload | undefined => {
  const metadata = app().messages[message.name];
  if (!metadata) throw Error(`Please register message: ${message.name}`);
  if (metadata.schema) {
    const { value, error } = metadata.schema.validate(message.data, {
      abortEarly: false,
      allowUnknown: true
    });
    if (error) throw new ValidationError(error, message);
    return value;
  }
  return message.data;
};
