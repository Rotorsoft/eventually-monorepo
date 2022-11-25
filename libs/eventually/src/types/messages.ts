export type State = Record<string, unknown>;
export type Messages = Record<string, Record<string, unknown>>;

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
 * Actors invoke commands
 * - `name` Actor name
 * - `roles` Actor roles
 */
export type Actor = {
  name: string;
  roles: string[];
};

/**
 * Commands are messages with optional arguments
 * - `id?` Target aggregate id
 * - `expectedVersion?` Target aggregate expected version
 * - `actor?` Actor invoking command
 */
export type Command<M extends Messages = Messages> = Message<M> & {
  readonly id?: string;
  readonly expectedVersion?: number;
  readonly actor?: Actor;
};

/**
 * Committed events have metadata describing correlation and causation
 * - `correlation` Id that correlates message flows across time and systems
 * - `causation` The direct cause of the event
 */
export type CommittedEventMetadata = {
  correlation: string;
  causation: {
    command?: {
      name: string;
      id?: string;
      expectedVersion?: number;
      actor?: Actor;
    };
    event?: {
      name: string;
      stream: string;
      id: number;
    };
  };
};

/**
 * Committed events are messages with commit details
 * - `id` Event index in the "all" stream
 * - `stream` Reducible stream name
 * - `version` Unique sequence number within the stream
 * - `created` Date-Time of creation
 * - `metadata` Event metadata
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
 */
export type Snapshot<S extends State = State, E extends Messages = Messages> = {
  readonly state: S;
  readonly event?: CommittedEvent<E>; // undefined when initialized
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
