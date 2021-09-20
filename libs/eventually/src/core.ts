import * as joi from "joi";

/**
 * Message payloads are records
 */
export type Payload = Record<string, unknown>;

/**
 * Messages transfer validatable information across service boundaries
 * Commands and Events are messages
 */
export type Message<Name extends string, Type extends Payload> = {
  readonly name: Name;
  readonly data?: Type;
  schema: () => joi.ObjectSchema<Message<Name, Type>>;
};

/**
 * Typed message factories
 */
export type MessageFactory<Messages> = {
  [Name in keyof Messages]: (
    data?: Messages[Name]
  ) => Message<Name & string, Messages[Name] & Payload>;
};

/**
 * Events committed to a stream have id and version
 */
export type CommittedEvent<Name extends string, Type extends Payload> = {
  readonly id: string;
  readonly version: string;
  readonly timestamp: Date;
} & Omit<Message<Name, Type>, "schema">;

/**
 * Typed command handlers validate model invariants
 * from current model state and incoming command,
 * producing uncommitted events when rules hold.
 * State is officially mutated once these events are
 * committed to the stream.
 * **TODO** return array of events
 */
export type CommandHandler<Model extends Payload, Commands, Events> = {
  [Name in keyof Commands as `on${Capitalize<Name & string>}`]: (
    state: Readonly<Model>,
    data?: Commands[Name] & Payload
  ) => Promise<Message<keyof Events & string, Payload>>;
};

/**
 * Typed generic event handlers that react to committed events by
 * executing logic and producing a type of response
 */
export type EventHandler<Response, Events> = {
  [Name in keyof Events as `on${Capitalize<Name & string>}`]: (
    event: CommittedEvent<Name & string, Events[Name] & Payload>
  ) => Promise<Response>;
};

/**
 * Policies respond with commands targetting aggregates.
 * The expected version of the targetted aggregate is optional.
 */
export type PolicyResponse<Commands> = {
  id: string;
  expectedVersion?: string;
  command: Message<keyof Commands & string, Payload>;
};

/**
 * Typed model reducers apply committed events to the current model,
 * returning a new mutated state
 */
export type ModelReducer<Model extends Payload, Events> = {
  readonly id: string;
  name: () => string;
  init: () => Readonly<Model>;
} & {
  [Name in keyof Events as `apply${Capitalize<Name & string>}`]: (
    state: Readonly<Model>,
    event: CommittedEvent<Name & string, Events[Name] & Payload>
  ) => Readonly<Model>;
};

/**
 * Aggregates are command handlers and model reducers
 */
export type Aggregate<Model extends Payload, Commands, Events> = ModelReducer<
  Model,
  Events
> &
  CommandHandler<Model, Commands, Events>;

/**
 * Policies are event handlers responding with optional targetted commands
 */
export type Policy<Commands, Events> = { name: () => string } & EventHandler<
  PolicyResponse<Commands> | undefined,
  Events
>;

/**
 * Projectors are event handlers without response, side effects
 * are projected events to other persistent state
 */
export type Projector<Events> = { name: () => string } & EventHandler<
  void,
  Events
>;

export const decamelize = (key: string): string =>
  key
    .replace(/([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu, "$1-$2")
    .replace(
      /(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
      "$1-$2"
    )
    .toLowerCase();

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
