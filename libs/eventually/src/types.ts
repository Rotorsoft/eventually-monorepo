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
 * Shortcut for messages
 */
export type MsgOf<T> = Message<keyof T & string, Payload>;

/**
 * Typed message factories
 */
export type MessageFactory<Messages> = {
  [Name in keyof Messages]: (
    data?: Messages[Name]
  ) => Message<Name & string, Messages[Name] & Payload>;
};

/**
 * Events committed to a stream have extra persisted attributes
 */
export type CommittedEvent<Name extends string, Type extends Payload> = {
  readonly eventId: number;
  readonly aggregateId: string;
  readonly aggregateVersion: string;
  readonly createdAt: Date;
  readonly name: Name;
  readonly data?: Type;
};

/**
 * Shortcuts for committed events
 */
export type EvtOf<E> = CommittedEvent<keyof E & string, Payload>;
export type Evt = CommittedEvent<string, Payload>;

/**
 * Aggregate snapshot after event is applied
 */
export type Snapshot<M extends Payload> = {
  event: Evt;
  state: M;
};

/**
 * Typed command handlers validate model invariants
 * from current model state and incoming command,
 * producing uncommitted events when rules hold.
 * State is officially mutated once these events are
 * committed to the stream.
 * **TODO** return array of events
 */
export type CommandHandler<M extends Payload, C, E> = {
  [Name in keyof C as `on${Capitalize<Name & string>}`]: (
    state: Readonly<M>,
    data?: C[Name] & Payload
  ) => Promise<MsgOf<E>>;
};

/**
 * Typed generic event handlers that react to committed events by
 * executing logic and producing a type of response
 */
export type EventHandler<Response, E> = {
  [Name in keyof E as `on${Capitalize<Name & string>}`]: (
    event: CommittedEvent<Name & string, E[Name] & Payload>
  ) => Promise<Response>;
};

/**
 * Policies respond with commands targetting aggregates.
 * The expected version of the targetted aggregate is optional.
 */
export type PolicyResponse<C> = {
  id: string;
  expectedVersion?: string;
  command: MsgOf<C>;
};

/**
 * Typed model reducers apply committed events to the current model,
 * returning a new mutated state
 */
export type ModelReducer<M extends Payload, E> = {
  readonly id: string;
  name: () => string;
  init: () => Readonly<M>;
} & {
  [Name in keyof E as `apply${Capitalize<Name & string>}`]: (
    state: Readonly<M>,
    event: CommittedEvent<Name & string, E[Name] & Payload>
  ) => Readonly<M>;
};

/**
 * Aggregates are command handlers and model reducers
 */
export type Aggregate<M extends Payload, C, E> = ModelReducer<M, E> &
  CommandHandler<M, C, E>;

export type AggregateFactory<M extends Payload, C, E> = (
  id: string
) => Aggregate<M, C, E>;

/**
 * Policies are event handlers responding with optional targetted commands
 */
export type Policy<C, E> = { name: () => string } & EventHandler<
  PolicyResponse<C> | undefined,
  E
>;

export type PolicyFactory<C, E> = () => Policy<C, E>;

/**
 * Projectors are event handlers without response, side effects
 * are projected events to other persistent state
 */
export type Projector<E> = { name: () => string } & EventHandler<void, E>;
