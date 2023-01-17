export type State = Record<string, unknown>;
export type Messages = Record<string, Record<string, unknown>>;
export type ProjectionState = State & { id: string };

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
 * Actors invoke commands and have
 * - `name` a name
 * - `roles` some roles
 */
export type Actor = {
  name: string;
  roles: string[];
};

/**
 * Commands are messages with optional target arguments
 * - `id?` the target aggregate id
 * - `expectedVersion?` the expected version of the aggregate or a concurrency error is thrown
 * - `actor?` the actor invoking the command
 */
export type CommandTarget = {
  readonly id?: string;
  readonly expectedVersion?: number;
  readonly actor?: Actor;
};
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
 * - `applyCount?` the number of events reduced after last snapshot
 */
export type Snapshot<S extends State = State, E extends Messages = Messages> = {
  readonly state: S;
  readonly event?: CommittedEvent<E>; // undefined when initialized
  readonly applyCount: number;
};

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

/**
 * Response from event handlers
 *
 * - `command?` the command triggered by the event handler
 * - `state?` the reducible state affected
 */
export type EventResponse<S extends State, C extends Messages> = {
  command?: Command<C>;
  state?: S;
};

/**
 * Projection filters
 *
 * - `upsert?` key=value filters and values tuple used to upsert records
 * - `delete?` key=value filters used to delete records
 */
export type Projection<S extends ProjectionState> = {
  upsert?: [Partial<S>, Partial<Omit<S, "id">>];
  delete?: Partial<S>;
};

/**
 * Projection results after commit
 *
 * - `projection` the projection filters
 * - `upserted` the number of upserted records
 * - `deleted` the number of deleted records
 * - `watermark` the stored watermark
 */
export type ProjectionResults<S extends ProjectionState> = {
  projection: Projection<S>;
  upserted: number;
  deleted: number;
  watermark: number;
};
