import * as joi from "joi";
import {
  AggregateFactory,
  ExternalSystemFactory,
  MessageFactory,
  MessageHandler,
  MsgOf,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  Reducible,
  Streamable
} from "./types";

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
 * Extracts message handlers from message factory
 * @param factory message factory
 * @returns array of message handlers
 */
export const handlersOf = <Messages>(
  factory: MessageFactory<Messages>
  // eslint-disable-next-line
): Function[] => {
  // eslint-disable-next-line
  return Object.values<Function>(factory).filter((f: Function) => {
    const message = f();
    return message.name && message.schema;
  });
};

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
 * @param factory reducible factory
 * @returns the reducible path
 */
export const reduciblePath = <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E> | ProcessManagerFactory<M, C, E>
): string => "/".concat(decamelize(factory.name), "/:id");

/**
 * Normalizes command handler paths
 * @param factory command handler factory
 * @param command command
 * @returns normalized path
 */
export const commandHandlerPath = <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E> | ExternalSystemFactory<C, E>,
  command: MsgOf<C>
): string =>
  "/".concat(
    decamelize(factory.name),
    getReducible(factory(undefined)) ? "/:id/" : "/",
    decamelize(command.name)
  );

/**
 * Normalizes event handler paths
 * @param factory event handler factory
 * @param event event
 * @returns normalized path
 */
export const eventHandlerPath = <M extends Payload, C, E>(
  factory: PolicyFactory<C, E> | ProcessManagerFactory<M, C, E>,
  event: MsgOf<E>
): string => "/".concat(decamelize(factory.name), "/", decamelize(event.name));

/**
 * Concatenates committed event persisted schema for validation
 * @param schema message schema
 * @returns committed message schema
 */
export const committedSchema = (schema: joi.ObjectSchema): joi.ObjectSchema =>
  schema.concat(
    joi.object({
      id: joi.number().integer().required(),
      stream: joi.string().required(),
      version: joi.number().integer().required(),
      created: joi.date().required()
    })
  );

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
    public readonly events: { name: string; data?: Payload }[],
    public readonly expectedVersion: number
  ) {
    super(Errors.ConcurrencyError);
  }
}
