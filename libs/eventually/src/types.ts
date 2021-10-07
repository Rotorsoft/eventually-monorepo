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
export type CommittedEvent<Name extends string, Type extends Payload> = Omit<
  Message<Name, Type>,
  "schema"
> & {
  readonly id: number;
  readonly stream: string;
  readonly version: number;
  readonly created: Date;
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
  state?: M;
};

/**
 * Typed model reducers apply committed events to the current model,
 * returning a new mutated state
 */
export type ModelReducer<M extends Payload, E> = {
  stream: () => string;
  init: () => Readonly<M>;
} & {
  [Name in keyof E as `apply${Capitalize<Name & string>}`]: (
    state: Readonly<M>,
    event: CommittedEvent<Name & string, E[Name] & Payload>
  ) => Readonly<M>;
};

/**
 * Aggregates define the consistency boundaries of a business model (entity graph)
 * Commands are handled following these steps:
 * - Reduces model from event stream
 * - Validates model invariants for this command, throwing error when violations found
 * - Commits new events as side effects (model mutation)
 * - Emits newly committed events
 */
export type Aggregate<M extends Payload, C, E> = ModelReducer<M, E> & {
  [Name in keyof C as `on${Capitalize<Name & string>}`]: (
    data?: C[Name] & Payload,
    state?: Readonly<M>
  ) => Promise<MsgOf<E>[]>;
};

export type AggregateFactory<M extends Payload, C, E> = (
  id: string
) => Aggregate<M, C, E>;

/**
 * External Systems interface
 * Commands are handled following these steps:
 * - Execute integration logic
 * - Commits new events as side effects
 * - Emits newly committed events
 */
export type ExternalSystem<C, E> = { stream: () => string } & {
  [Name in keyof C as `on${Capitalize<Name & string>}`]: (
    data?: C[Name] & Payload
  ) => Promise<MsgOf<E>[]>;
};

export type ExternalSystemFactory<C, E> = () => ExternalSystem<C, E>;

/**
 * Typed generic event handlers that react to committed events by
 * executing logic and producing a type of response
 */
export type EventHandler<Response, E, M extends Payload> = {
  [Name in keyof E as `on${Capitalize<Name & string>}`]: (
    event: CommittedEvent<Name & string, E[Name] & Payload>,
    state?: Readonly<M>
  ) => Promise<Response>;
};

/**
 * Policies can respond with commands,
 * targetting external systems
 * or aggregates when id and optional expectedVersion are included in response
 */
export type PolicyResponse<C> = {
  command: MsgOf<C>;
  id?: string;
  expectedVersion?: string;
};

/**
 * Policies are event handlers responding with optional targetted commands.
 * An optional model reducer allows to expand the consistency boundaries of
 * events arriving from multiple aggregates or external services into a
 * dedicated state machine
 */
export type Policy<C, E, M extends Payload = undefined> = EventHandler<
  PolicyResponse<C> | undefined,
  E,
  M
> & { reducer?: ModelReducer<M, E> };

export type PolicyFactory<C, E, M extends Payload = undefined> = (
  event: EvtOf<E>
) => Policy<C, E, M>;

/**
 * Projectors are event handlers without response, side effects
 * are projected events to other persistent state
 */
export type Projector<E> = EventHandler<void, E, undefined>;
