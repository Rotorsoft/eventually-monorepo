import * as joi from "joi";
import { SnapshotStore } from ".";

/**
 * Message payloads are objects
 */
export type Payload = Record<string, unknown>;

/**
 * Messages transfer validatable information across service boundaries
 */
export type Message<Name extends string, Type extends Payload> = {
  readonly name: Name;
  scope: () => "public" | "private";
  readonly data?: Type;
  schema?: () => joi.ObjectSchema<Type>;
};

export type MessageFactories<Messages> = {
  [Name in keyof Messages]: (
    data?: Messages[Name]
  ) => Message<Name & string, Messages[Name] & Payload>;
};

/**
 * Untyped message factory
 */
export type MessageFactory = (data?: Payload) => Message<string, Payload>;

/**
 * Committed events have:
 * - `id` The index of the event in the "all" stream
 * - `stream` The unique name of the reducible stream
 * - `version` The unique sequence number within the stream
 * - `created` The date-time of creation
 * - `name` The unique name of the event
 * - `data?` The optional payload
 */
export type CommittedEvent<Name extends string, Type extends Payload> = Message<
  Name,
  Type
> & {
  readonly id: number;
  readonly stream: string;
  readonly version: number;
  readonly created: Date;
  readonly name: string;
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
 * Event handlers can respond with commands targetting command handlers (aggregates or systems)
 * - Response is routed to aggregates when aggregate id and optional expectedVersion are included
 */
export type CommandResponse = {
  command: MessageFactory;
  data?: Payload;
  id?: string;
  expectedVersion?: number;
};

/**
 * Policies handle events and optionally produce commands
 */
export type Policy<E> = {
  [Name in keyof E as `on${Capitalize<Name & string>}`]: (
    event: CommittedEvent<Name & string, E[Name] & Payload>
  ) => Promise<CommandResponse | undefined>;
};
export type PolicyFactory<E> = () => Policy<E>;

/**
 * Process Managers handle events and optionally produce commands
 * - Have reducible state, allowing to expand the consistency boundaries of multiple events into a local state machine
 */
export type ProcessManager<M extends Payload, E> = Reducible<M, E> & {
  [Name in keyof E as `on${Capitalize<Name & string>}`]: (
    event: CommittedEvent<Name & string, E[Name] & Payload>,
    state: Readonly<M>
  ) => Promise<CommandResponse | undefined>;
};
export type ProcessManagerFactory<M extends Payload, E> = (
  event: EvtOf<E>
) => ProcessManager<M, E>;

/**
 * Options to query the all stream
 */
export type AllQuery = {
  stream?: string;
  name?: string;
  after?: number;
  limit?: number;
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
  | ProcessManager<M, E>
  | Policy<E>;

/**
 * All message handler factory types
 */
export type MessageHandlerFactory<M extends Payload, C, E> =
  | AggregateFactory<M, C, E>
  | ExternalSystemFactory<C, E>
  | ProcessManagerFactory<M, E>
  | PolicyFactory<E>;
