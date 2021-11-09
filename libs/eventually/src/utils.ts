import * as joi from "joi";
import {
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

/**
 * Binds messages to options and payloads
 * @param options The message options
 * @param data The message payload
 * @returns The bound message
 */
export const bind = <Name extends string, Type extends Payload>(
  name: Name,
  data?: Type,
  id?: string,
  expectedVersion?: number
): Message<Name, Type> | Command<Name, Type> => ({
  name,
  data,
  id,
  expectedVersion
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
 * Extracts events from reducible
 * @param reducible the reducible
 * @returns array of event names
 */
export const eventsOf = <M extends Payload, E>(
  reducible: Reducible<M, E>
): string[] => {
  // eslint-disable-next-line
  return Object.values<Function>(reducible)
    .filter((value) => {
      return typeof value === "function" && value.name.startsWith("apply");
    })
    .map((value) => value.name.substr(5));
};

/**
 * Extracts messages from handler
 * @param handler The message handler
 * @returns array of message names
 */
export const messagesOf = <M extends Payload, C, E>(
  handler: CommandHandler<M, C, E> | EventHandler<M, C, E>
): string[] => {
  // eslint-disable-next-line
  return Object.values<Function>(handler)
    .filter((value) => {
      return typeof value === "function" && value.name.startsWith("on");
    })
    .map((value) => value.name.substr(2));
};

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
 * @param name event name
 * @returns normalized path
 */
export const eventHandlerPath = <M extends Payload, C, E>(
  handler: EventHandlerFactory<M, C, E>,
  name: string
): string => "/".concat(decamelize(handler.name), "/", decamelize(name));

export enum Errors {
  ValidationError = "Validation Error",
  ConcurrencyError = "Concurrency Error"
}

export class ValidationError extends Error {
  public readonly details;
  constructor(errors: joi.ValidationError) {
    super(Errors.ValidationError);
    this.details = errors.details.flatMap((item) => item.message);
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
