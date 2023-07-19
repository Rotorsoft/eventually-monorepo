import { Operator } from "./enums";

export type State = Record<string, any>;
export type StateWithId<S extends State> = S & { id: string };
export type Messages = Record<string, Record<string, any>>;

/**
 * Messages have
 * - `name` a name
 * - `data` a payload
 */
export type Message<M extends Messages = Messages> = {
  readonly name: keyof M & string;
  readonly data: Readonly<M[keyof M & string]>;
};

/**
 * Actors are either humans or policies invoking commands
 * - `id` actor identifier
 *    - for human actors, this is usually a primary key to the users table, extracted from JWT, etc
 *    - for process managers, this is the secondary stream used to reduce the state
 * - `name` actor name
 *    - for human actors, could be the full name, email, etc ... for log auditing purposes
 *    - for process managers, the factory name
 * - `roles?` array of role names used for authorization invariants (usually extracted from JWT and used by validation middleware)
 * - `expectedCount?` expected count of actor events when process managers are enforcing transaction integrity
 */
export type Actor = {
  readonly id: string;
  readonly name: string;
  readonly roles?: string[];
  readonly expectedCount?: number;
};

/**
 * Commands are messages with optional target arguments
 * - `stream?` the target stream
 * - `expectedVersion?` the expected version of the stream or a concurrency error is thrown
 * - `actor?` the actor invoking the command
 */
export type CommandTarget = {
  readonly stream?: string;
  readonly expectedVersion?: number;
  readonly actor?: Actor;
};

/**
 * Commands are messages with optional target arguments
 * - `stream?` the target stream
 * - `expectedVersion?` the expected version of the stream or a concurrency error is thrown
 * - `actor?` the actor invoking the command
 */
export type Command<M extends Messages = Messages> = Message<M> & CommandTarget;

/**
 * Committed events have metadata describing correlation and causation
 * - `correlation` unique id that correlates message flows across time and systems
 * - `causation` The direct cause of the event
 */
export type CommittedEventMetadata = {
  readonly correlation: string;
  readonly causation: {
    readonly command?: {
      readonly name: string;
    } & CommandTarget;
    readonly event?: {
      readonly name: string;
      readonly stream: string;
      readonly id: number;
    };
  };
};

/**
 * Committed events are messages with commit details
 * - `id` the unique index of the event in the "all" stream
 * - `stream` the reducible stream name of the artifact that produced the event
 * - `version` the unique and continuous sequence number within the stream
 * - `created` the date-time of creation
 * - `metadata` the event metadata
 */
export type CommittedEvent<M extends Messages = Messages> = Message<M> & {
  readonly id: number;
  readonly stream: string;
  readonly version: number;
  readonly created: Date;
  readonly metadata: CommittedEventMetadata;
};

/**
 * Snapshots hold reduced state and last applied event
 * - `state` the current state of the artifact
 * - `event?` the last event applied to the state
 * - `applyCount` the number of events reduced after last snapshot
 * - `stateCount` the number of state events after last snapshot
 */
export type Snapshot<S extends State = State, E extends Messages = Messages> = {
  readonly state: S;
  readonly event?: CommittedEvent<E>; // undefined when initialized
  readonly applyCount: number;
  readonly stateCount: number;
};

/**
 * Options to query the all stream
 * - `stream?` filter by stream
 * - `names?` filter by event names
 * - `before?` filter events before this id
 * - `after?` filter events after this id
 * - `limit?` limit the number of events to return
 * - `created_before?` filter events created before this date/time
 * - `created_after?` filter events created after this date/time
 * - `backward?` order descending when true
 * - `correlation?` filter by correlation
 * - `actor?` filter by actor id (mainly used to reduce process managers)
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
  readonly actor?: string;
};

/**
 * Projection slices
 *
 * - `upserts?` the array of key=value expressions used to upsert slices of records
 * - `deletes?` the array of key=value expressions used to delete records
 */
export type Projection<S extends State> = {
  readonly upserts?: Array<{
    where: Partial<StateWithId<S>>;
    values: Partial<S>;
  }>;
  readonly deletes?: Array<{ where: Partial<StateWithId<S>> }>;
};

/**
 * Projection results after commit
 *
 * - `upserted` the upserted counts
 * - `deleted` the deleted counts
 * - `watermark` the stored watermark
 * - `error?` the error message when project throws
 */
export type ProjectionResults<S extends State = State> = {
  readonly upserted: Array<{
    where: Partial<StateWithId<S>>;
    count: number;
  }>;
  readonly deleted: Array<{
    where: Partial<StateWithId<S>>;
    count: number;
  }>;
  readonly watermark: number;
  readonly error?: string;
};

/**
 * Projection record
 *
 * - `state` the stored projection state
 * - `watermark` the stored watermark
 */
export type ProjectionRecord<S extends State = State> = {
  readonly state: StateWithId<S>;
  readonly watermark: number;
};

/**
 * Filter condition
 */
export type Condition<T> = {
  readonly operator: Operator;
  readonly value: T;
};

/**
 * Options to query projections
 * - `select?` selected fields
 * - `where?` filters
 * - `sort?` sorted fields
 * - `limit?` limit number of records
 */
export type ProjectionWhere<S extends State = State> = {
  readonly [K in keyof StateWithId<S>]?: Condition<StateWithId<S>[K]>;
};
export type ProjectionSort<S extends State = State> = {
  readonly [K in keyof StateWithId<S>]?: "asc" | "desc";
};
export type ProjectionQuery<S extends State = State> = {
  readonly select?: Array<keyof StateWithId<S>>;
  readonly where?: ProjectionWhere<S>;
  readonly sort?: ProjectionSort<S>;
  readonly limit?: number;
};

/**
 * Response from event handlers
 *
 * - `id`: the event id
 * - `error?`: error message when failed
 * - `command?` the command triggered by the event handler when handled by policies
 * - `state?` the reducible state when handled by process managers
 * - `projection?` the projection results when handled by a projector
 */
export type EventResponse<S extends State, C extends Messages> = {
  readonly id: number;
  readonly error?: string;
  readonly command?: Command<C>;
  readonly state?: S;
  readonly projection?: ProjectionResults<S>;
};
