import joi from "joi";
import { Command, CommittedEvent, Message, Payload } from "./messages";

/**
 * Artifacts that commit events to a stream
 */
export type Streamable = { stream: () => string };

/**
 * Artifacts that reduce models from event streams
 */
export type Reducible<M extends Payload, E> = Streamable & {
  schema?: () => joi.ObjectSchema<M>;
  schemas?: { state?: joi.ObjectSchema<M> };
  init: () => Readonly<M>;
} & {
  [Key in keyof E as `apply${Capitalize<Key & string>}`]: (
    state: Readonly<M>,
    event: CommittedEvent<Key & string, E[Key] & Payload>
  ) => Readonly<M>;
};

export type Reducer<M extends Payload, C, E> = (
  factory: ReducibleFactory<M, C, E>,
  id: string,
  useSnapshot?: boolean,
  callback?: (snapshot: Snapshot<M>) => void
) => Promise<Snapshot<M> | Snapshot<M>[]>;

/**
 * Reducible snapshots after events are applied
 */
export type Snapshot<M extends Payload> = {
  readonly event: CommittedEvent<string, Payload>;
  readonly state?: M;
};

/**
 * Message handlers with schema definitions
 */
export type WithSchemas<C, E> = {
  schemas?: {
    [Key in keyof (C & E)]?: joi.ObjectSchema<(C & E)[Key] & Payload>;
  };
};

/**
 * Aggregates handle commands and produce events
 * - Define the consistency boundaries of a business model (entity graph)
 * - Have reducible state
 */
export type Aggregate<M extends Payload, C, E> = Reducible<M, E> &
  WithSchemas<C, E> & {
    [Key in keyof C as `on${Capitalize<Key & string>}`]: (
      data?: C[Key] & Payload,
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
export type ExternalSystem<C, E> = Streamable &
  WithSchemas<C, E> & {
    [Key in keyof C as `on${Capitalize<Key & string>}`]: (
      data?: C[Key] & Payload
    ) => Promise<Message<keyof E & string, Payload>[]>;
  };
export type ExternalSystemFactory<C, E> = () => ExternalSystem<C, E>;

/**
 * Policies handle events and optionally produce commands
 */
export type Policy<C, E> = WithSchemas<C, E> & {
  [Key in keyof E as `on${Capitalize<Key & string>}`]: (
    event: CommittedEvent<Key & string, E[Key] & Payload>
  ) => Promise<Command<keyof C & string, Payload> | undefined>;
};
export type PolicyFactory<C, E> = () => Policy<C, E>;

/**
 * Process Managers handle events and optionally produce commands
 * - Have reducible state, allowing to expand the consistency boundaries of multiple events into a local state machine
 */
export type ProcessManager<M extends Payload, C, E> = Reducible<M, E> &
  WithSchemas<C, E> & {
    [Key in keyof E as `on${Capitalize<Key & string>}`]: (
      event: CommittedEvent<Key & string, E[Key] & Payload>,
      state: Readonly<M>
    ) => Promise<Command<keyof C & string, Payload> | undefined>;
  };
export type ProcessManagerFactory<M extends Payload, C, E> = (
  eventOrId: CommittedEvent<keyof E & string, Payload> | string
) => ProcessManager<M, C, E>;

/**
 * Command adapters convert payloads to commands
 * This is like a "Policy" with a more flexible input interface
 */
export type CommandAdapter<P extends Payload, C> = {
  adapt: (
    payload: P
  ) => Command<keyof C & string, C[keyof C & string] & Payload>;
  schema: joi.ObjectSchema<P>;
};
export type CommandAdapterFactory<P extends Payload, C> = () => CommandAdapter<
  P,
  C
>;

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
 * Options to query snapshots
 * - limit? limit the number of snapthots to return
 */
export type SnapshotsQuery = {
  readonly limit?: number;
};
