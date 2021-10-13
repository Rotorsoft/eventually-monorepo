import * as joi from "joi";

import {
  AggregateFactory,
  ExternalSystemFactory,
  MessageFactory,
  MsgOf,
  Payload,
  PolicyFactory,
  ProcessManagerFactory
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
    "init" in factory(undefined) ? "/:id/" : "",
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
      version: joi.number().required(),
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

/**
 * Wraps creation of singletons around factory functions
 * @param target the factory function
 * @returns the singleton function
 */
const instances: { [name: string]: unknown } = {};
export const Singleton =
  <T>(target: (...args: any[]) => T) =>
  (...args: any[]): T => {
    if (!instances[target.name]) instances[target.name] = target(...args);
    return instances[target.name] as T;
  };


export const shouldStoreSnapshot = (lastCommittedEvent: {version:string}, snapshotEventsThreshold?:number):boolean => 
  snapshotEventsThreshold && 
  lastCommittedEvent.version !== '0' && 
  Number(lastCommittedEvent.version) % snapshotEventsThreshold === 0
