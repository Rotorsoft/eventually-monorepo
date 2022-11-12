import {
  Command,
  CommittedEvent,
  Message,
  Messages,
  Payload
} from "./messages";
import { Schema, WithSchemas } from "./schemas";

/**
 * Artifacts that commit events to a stream
 */
export type Streamable = { stream: () => string };

/**
 * Artifacts that reduce models from event streams
 */
export type Reducible<M extends Payload, E extends Messages> = Streamable & {
  schema?: () => Schema<M>;
  schemas?: { state?: Schema<M> };
  init: () => Readonly<M>;
} & {
  [Key in keyof E as `apply${Capitalize<Key & string>}`]: (
    state: Readonly<M>,
    event: Readonly<CommittedEvent<Pick<E, Key>>>
  ) => Readonly<M>;
};

export type Reducer<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = (
  factory: ReducibleFactory<M, C, E>,
  id: string,
  useSnapshot?: boolean,
  callback?: (snapshot: Snapshot<M, E>) => void
) => Promise<Snapshot<M, E> | Snapshot<M, E>[]>;

/**
 * Reducible snapshots after events are applied
 */
export type Snapshot<M extends Payload, E extends Messages> = {
  readonly event: CommittedEvent<E>;
  readonly state?: M;
};

/**
 * Aggregates handle commands and produce events
 * - Define the consistency boundaries of a business model (entity graph)
 * - Have reducible state
 */
export type Aggregate<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = Reducible<M, E> &
  WithSchemas<C, E> & {
    [Key in keyof C as `on${Capitalize<Key & string>}`]: (
      data?: Readonly<C[Key]>,
      state?: Readonly<M>
    ) => Promise<Message<E>[]>;
  };
export type AggregateFactory<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = (id: string) => Aggregate<M, C, E>;

/**
 * External Systems handle commands and produce events
 * - Have their own stream
 */
export type ExternalSystem<
  C extends Messages,
  E extends Messages
> = Streamable &
  WithSchemas<C, E> & {
    [Key in keyof C as `on${Capitalize<Key & string>}`]: (
      data?: Readonly<C[Key]>
    ) => Promise<Message<E>[]>;
  };
export type ExternalSystemFactory<
  C extends Messages,
  E extends Messages
> = () => ExternalSystem<C, E>;

/**
 * Policies handle events and optionally produce commands
 */
export type Policy<C extends Messages, E extends Messages> = WithSchemas<
  C,
  E
> & {
  [Key in keyof E as `on${Capitalize<Key & string>}`]: (
    event: Readonly<CommittedEvent<Pick<E, Key>>>
  ) => Promise<Command<C> | undefined>;
};
export type PolicyFactory<
  C extends Messages,
  E extends Messages
> = () => Policy<C, E>;

/**
 * Process Managers handle events and optionally produce commands
 * - Have reducible state, allowing to expand the consistency boundaries of multiple events into a local state machine
 */
export type ProcessManager<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = Reducible<M, E> &
  WithSchemas<C, E> & {
    [Key in keyof E as `on${Capitalize<Key & string>}`]: (
      event: Readonly<CommittedEvent<Pick<E, Key>>>,
      state: Readonly<M>
    ) => Promise<Command<C> | undefined>;
  };
export type ProcessManagerFactory<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = (eventOrId: CommittedEvent<E> | string) => ProcessManager<M, C, E>;

/**
 * Command adapters convert payloads to commands
 * This is a "Policy" with a flexible input interface
 */
export type CommandAdapter<P extends Payload, C extends Messages> = {
  adapt: (payload: Readonly<P>) => Command<C>;
  schema: Schema<P>;
};
export type CommandAdapterFactory<
  P extends Payload,
  C extends Messages
> = () => CommandAdapter<P, C>;

/**
 * All message handler factory types
 */
export type MessageHandlerFactory<
  M extends Payload,
  C extends Messages,
  E extends Messages
> =
  | AggregateFactory<M, C, E>
  | ExternalSystemFactory<C, E>
  | ProcessManagerFactory<M, C, E>
  | PolicyFactory<C, E>;

export type ReducibleFactory<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = AggregateFactory<M, C, E> | ProcessManagerFactory<M, C, E>;

export type CommandHandlerFactory<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = AggregateFactory<M, C, E> | ExternalSystemFactory<C, E>;

export type EventHandlerFactory<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = ProcessManagerFactory<M, C, E> | PolicyFactory<C, E>;

export type CommandHandler<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = Aggregate<M, C, E> | ExternalSystem<C, E>;

export type EventHandler<
  M extends Payload,
  C extends Messages,
  E extends Messages
> = ProcessManager<M, C, E> | Policy<C, E>;

/**
 * All message handler types
 */
export type MessageHandler<
  M extends Payload,
  C extends Messages,
  E extends Messages
> =
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
