import * as joi from "joi";
import { SnapshotStore } from ".";

/**
 * Message payloads are objects
 */
export type Payload = Record<string, unknown>;

/**
 * Message scopes can be
 * - `public` to expose public endpoints (HTTP command and event handlers), and publish events to brokers for async communication
 * - `private` to connect messages synchronously (in-process) - **default**
 */
export enum Scopes {
  private = "private",
  public = "public"
}

/**
 * Message options
 * - `scope?` The optional scope of the message
 * - `schema?` The optional payload validation schema
 */
export type MessageOptions<_ extends string, Type extends Payload> = () => {
  scope?: Scopes;
  schema?: joi.ObjectSchema<Type>;
};

/**
 * Dictionaries of message factories keyed by message names
 */
export type MessageFactory<Messages> = {
  [Name in keyof Messages]: MessageOptions<
    Name & string,
    Messages[Name] & Payload
  >;
};

/**
 * Messages have
 * - `name` The bound message name
 * - `data?` Optional payload
 */
export type Message<Name extends string, Type extends Payload> = {
  readonly name: Name;
  readonly data?: Type;
};

/**
 * Commands are messages with optional target arguments
 * - `id?` Target aggregate id
 * - `expectedVersion?` Target aggregate expected version
 */
export type Command<Name extends string, Type extends Payload> = Message<
  Name,
  Type
> & {
  readonly id?: string;
  readonly expectedVersion?: number;
};

/**
 * Committed events have:
 * - `id` The index of the event in the "all" stream
 * - `stream` The unique name of the reducible stream
 * - `version` The unique sequence number within the stream
 * - `created` The date-time of creation
 * - `name` The unique name of the event
 * - `data?` The optional payload
 */
export type CommittedEvent<Name extends string, Type extends Payload> = {
  readonly id: number;
  readonly stream: string;
  readonly version: number;
  readonly created: Date;
  readonly name: Name;
  readonly data?: Type;
};

/**
 * Artifacts that commit events to a stream
 */
export type Streamable = { stream: () => string };

/**
 * Artifacts that reduce models from event streams
 */
export type Reducible<M extends Payload, E> = Streamable & {
  schema: () => joi.ObjectSchema<M>;
  init: () => Readonly<M>;
  snapshot?: {
    threshold: number;
    factory?: () => SnapshotStore;
  };
} & {
  [Name in keyof E as `apply${Capitalize<Name & string>}`]: (
    state: Readonly<M>,
    event: CommittedEvent<Name & string, E[Name] & Payload>
  ) => Readonly<M>;
};

/**
 * Reducible snapshots after events are applied
 */
export type Snapshot<M extends Payload> = {
  readonly event: CommittedEvent<string, Payload>;
  readonly state?: M;
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
  ) => Promise<Message<keyof E & string, Payload>[]>;
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
  ) => Promise<Message<keyof E & string, Payload>[]>;
};
export type ExternalSystemFactory<C, E> = () => ExternalSystem<C, E>;

/**
 * Policies handle events and optionally produce commands
 */
export type Policy<C, E> = {
  [Name in keyof E as `on${Capitalize<Name & string>}`]: (
    event: CommittedEvent<Name & string, E[Name] & Payload>
  ) => Promise<Command<keyof C & string, Payload> | undefined>;
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
  ) => Promise<Command<keyof C & string, Payload> | undefined>;
};
export type ProcessManagerFactory<M extends Payload, C, E> = (
  event: CommittedEvent<keyof E & string, Payload>
) => ProcessManager<M, C, E>;

/**
 * Options to query the all stream
 */
export type AllQuery = {
  readonly stream?: string;
  readonly name?: string;
  readonly after?: number;
  readonly limit?: number;
};

/**
 * Apps are getters of reducibles
 */
export type Getter = <M extends Payload, E>(
  reducible: Reducible<M, E>,
  useSnapshot?: boolean,
  callback?: (snapshot: Snapshot<M>) => void
) => Promise<Snapshot<M> | Snapshot<M>[]>;

/**
 * All message handler types
 */
export type MessageHandler<M extends Payload, C, E> =
  | Aggregate<M, C, E>
  | ExternalSystem<C, E>
  | ProcessManager<M, C, E>
  | Policy<C, E>;

/**
 * All message handler factory types
 */
export type MessageHandlerFactory<M extends Payload, C, E> =
  | AggregateFactory<M, C, E>
  | ExternalSystemFactory<C, E>
  | ProcessManagerFactory<M, C, E>
  | PolicyFactory<C, E>;

export type ReducibleFactory<M extends Payload, C, E> =
  | AggregateFactory<M, C, E>
  | ProcessManagerFactory<M, C, E>;

export type CommandHandlerFactory<M extends Payload, C, E> =
  | AggregateFactory<M, C, E>
  | ExternalSystemFactory<C, E>;

export type EventHandlerFactory<M extends Payload, C, E> =
  | ProcessManagerFactory<M, C, E>
  | PolicyFactory<C, E>;

export type CommandHandler<M extends Payload, C, E> =
  | Aggregate<M, C, E>
  | ExternalSystem<C, E>;

export type EventHandler<M extends Payload, C, E> =
  | ProcessManager<M, C, E>
  | Policy<C, E>;
