import * as joi from "joi";
import { SnapshotStore } from ".";

/**
 * Resource disposer function
 */
export type Disposer = () => Promise<void>;
/**
 * Resource Seeder function
 */
export type Seeder = () => Promise<void>;

//=====================================================================================
// COMMAND LEVEL
//=====================================================================================
/**
 * Message payloads are objects
 */
export type Payload = Record<string, unknown>;

/**
 * Messages have
 * - `name` Bound message name
 * - `data?` Optional payload
 */
export type Message<Name extends string, Type extends Payload> = {
  readonly name: Name;
  readonly data?: Type;
};

/**
 * Actors invoke public commands
 * - `name` Actor name
 * - `roles` Actor roles
 */
export type Actor = {
  name: string;
  roles: string[];
};

/**
 * Commands are messages with optional target arguments
 * - `id?` Target aggregate id
 * - `expectedVersion?` Target aggregate expected version
 * - `actor?` Actor invoking this command
 */
export type Command<Name extends string, Type extends Payload> = Message<
  Name,
  Type
> & {
  readonly id?: string;
  readonly expectedVersion?: number;
  readonly actor?: Actor;
};

/**
 * Committed event metadata
 * - `correlation` Id that correlates message flows across time and systems
 * - `causation` The direct cause of the event
 */
export type CommittedEventMetadata = {
  correlation: string;
  causation: {
    command?: Command<string, Payload>;
    event?: {
      name: string;
      stream: string;
      id: number;
    };
  };
};

/**
 * Committed events have:
 * - `id` Event index in the "all" stream
 * - `stream` Reducible stream name
 * - `version` Unique sequence number within the stream
 * - `created` Date-Time of creation
 * - `name` Event name
 * - `data?` Otional payload
 * - `metadata?` Optional metadata
 */
export type CommittedEvent<Name extends string, Type extends Payload> = {
  readonly id: number;
  readonly stream: string;
  readonly version: number;
  readonly created: Date;
  readonly name: Name;
  readonly data?: Type;
  readonly metadata?: CommittedEventMetadata;
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

/**
 * All message handler types
 */
export type MessageHandler<M extends Payload, C, E> =
  | Aggregate<M, C, E>
  | ExternalSystem<C, E>
  | ProcessManager<M, C, E>
  | Policy<C, E>;

//=====================================================================================
// QUERY LEVEL
//=====================================================================================
/**
 * Options to query the all stream
 * - stream? filter by stream
 * - names? filter by event names
 * - before? filter events before this id
 * - after? filter events after this id
 * - limit? limit the number of events to return
 * - created_before? filter events created before this date/time
 * - created_after? filter events created after this date/time
 * - backward? order descending when true
 * - correlation? filter by correlation
 */
export type AllQuery = {
  readonly stream?: string;
  readonly names?: string[];
  readonly before?: number;
  readonly after?: number;
  readonly limit?: number;
  readonly created_before?: Date;
  readonly created_after?: Date;
  readonly backward?: boolean;
  readonly correlation?: string;
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
 * Store stats
 */
export type StoreStat = {
  name: string;
  count: number;
  firstId?: number;
  lastId?: number;
  firstCreated?: Date;
  lastCreated?: Date;
};
