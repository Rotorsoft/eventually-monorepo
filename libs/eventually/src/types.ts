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
  scope: () => "public" | "private";
  schema: () => joi.ObjectSchema<Message<Name, Type>>;
};

/**
 * Shortcuts for messages
 */
export type MsgOf<T> = Message<keyof T & string, Payload>;
export type Msg = MsgOf<unknown>;

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
export type CommittedEvent<Name extends string, Type extends Payload> = Message<
  Name,
  Type
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
export type Evt = EvtOf<unknown>;

/**
 * Aggregate snapshot after event is applied
 */
export type Snapshot<M extends Payload> = {
  event: Evt;
  state?: M;
};

/**
 * Artifacts that commit events to a stream
 */
export type Streamable = { stream: () => string };

/**
 * Artifacts that reduce models from event streams
 */
export type Reducible<M extends Payload, E> = Streamable & {
  init: () => Readonly<M>;
  snapshotEventsThreshold?: number
} & {
  [Name in keyof E as `apply${Capitalize<Name & string>}`]: (
    state: Readonly<M>,
    event: CommittedEvent<Name & string, E[Name] & Payload>
  ) => Readonly<M>;
};

/**
 * Aggregates handle commands and produce events
 * - Define the consistency boundaries of a business model (entity graph)
 * - Have reducible state
 */
export type Aggregate<M extends Payload, C, E> = Reducible<M, E> & {
  [Name in keyof C as `on${Capitalize<Name & string>}`]: (
    data?: C[Name] & Payload,
    state?: Readonly<M>
  ) => Promise<MsgOf<E>[]>;
};
export type AggregateFactory<M extends Payload, C, E> = (
  id: string
) => Aggregate<M, C, E>;

/**
 * External Systems handle commands and produce events
 * - Have their own stream
 */
export type ExternalSystem<C, E> = Streamable & {
  [Name in keyof C as `on${Capitalize<Name & string>}`]: (
    data?: C[Name] & Payload
  ) => Promise<MsgOf<E>[]>;
};
export type ExternalSystemFactory<C, E> = () => ExternalSystem<C, E>;

/**
 * Event handlers can respond with commands targetting command handlers (aggregates or systems)
 * - Response is routed to aggregates when aggregate id and optional expectedVersion are included
 */
export type CommandResponse<C> = {
  command: MsgOf<C>;
  id?: string;
  expectedVersion?: number;
};

/**
 * Policies handle events and optionally produce commands
 */
export type Policy<C, E> = {
  [Name in keyof E as `on${Capitalize<Name & string>}`]: (
    event: CommittedEvent<Name & string, E[Name] & Payload>
  ) => Promise<CommandResponse<C> | undefined>;
};
export type PolicyFactory<C, E> = () => Policy<C, E>;

/**
 * Process Managers handle events and optionally produce commands
 * - Have reducible state, allowing to expand the consistency boundaries of multiple events into a local state machine
 */
export type ProcessManager<M extends Payload, C, E> = Reducible<M, E> & {
  [Name in keyof E as `on${Capitalize<Name & string>}`]: (
    event: CommittedEvent<Name & string, E[Name] & Payload>,
    state: Readonly<M>
  ) => Promise<CommandResponse<C> | undefined>;
};
export type ProcessManagerFactory<M extends Payload, C, E> = (
  event: EvtOf<E>
) => ProcessManager<M, C, E>;

/**
 * Options to query the all stream
 */
export type AllQuery = {
  stream?: string;
  name?: string;
  after?: number;
  limit?: number;
};
