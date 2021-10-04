import * as joi from "joi";
import {
  AggregateFactory,
  Evt,
  EvtOf,
  MsgOf,
  MessageFactory,
  ModelReducer,
  Payload,
  PolicyFactory
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
 * Normalizes aggregate path
 * @param factory aggregate factory
 * @returns object with aggregate name and path
 */
export const aggregatePath = <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>
): { name: string; path: string } => {
  const name = factory.name;
  const path = "/".concat(decamelize(name), "/:id");
  return { name, path };
};

/**
 * Normalizes aggregate id
 * @param factory aggregate factory
 * @param id aggregate id
 * @returns normalized aggregate id
 */
export const aggregateId = <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>,
  id: string
): string => `${factory.name}:${id}`;

/**
 * Applies event to model
 * @param reducer model reducer
 * @param event event to apply
 * @param state current model state
 * @returns new model state
 */
export const apply = <M extends Payload, E>(
  reducer: ModelReducer<M, E>,
  event: Evt,
  state: M
): M => (reducer as any)["apply".concat(event.name)](state, event);

/**
 * Normalizes command paths
 * @param factory aggregate factory
 * @param command command
 * @returns normalized path
 */
export const commandPath = <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>,
  command: MsgOf<C>
): string =>
  "/".concat(decamelize(factory.name), "/:id/", decamelize(command.name));

/**
 * Normalizes event paths
 * @param factory policy factory
 * @param event event
 * @returns normalized path
 */
export const eventPath = <C, E>(
  factory: PolicyFactory<C, E>,
  event: EvtOf<E>
): string => "/".concat(decamelize(factory.name), "/", decamelize(event.name));

/**
 * Concatenates committed event persisted schema for validation
 * @param schema message schema
 * @returns committed message schema
 */
export const committedSchema = (schema: joi.ObjectSchema): joi.ObjectSchema =>
  schema.concat(
    joi.object({
      eventId: joi.number().integer().required(),
      aggregateId: joi.string().required(),
      aggregateVersion: joi.string().required(),
      createdAt: joi.date().required()
    })
  );

export class TopicNotFound extends Error {
  constructor(event: Evt) {
    super(`Topic "${event.name}" not found`);
  }
}

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
    public readonly expectedVersion: string
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
