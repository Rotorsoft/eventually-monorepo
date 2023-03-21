import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Messages,
  ProjectionResults,
  Projection,
  Snapshot,
  State,
  ProjectionRecord,
  ProjectionQuery
} from "../types/messages";
import { Disposable, Seedable } from "./generic";

// TODO: implement as projection of all events (by artifact)
/**
 * Basic event store statistics
 */
export type StoreStat = {
  name: string;
  count: number;
  firstId?: number;
  lastId?: number;
  firstCreated?: Date;
  lastCreated?: Date;
};

/**
 * Internal subscriptions managed by in-memory broker
 */
export type Subscription = {
  consumer: string;
  watermark: number;
  lease?: string;
  expires?: Date;
};

/**
 * Stores events in streams
 */
export interface Store extends Disposable, Seedable {
  /**
   * Queries the event store
   * @param callback callback predicate
   * @param query optional query values
   * @returns number of records
   */
  query: <E extends Messages>(
    callback: (event: CommittedEvent<E>) => void,
    query?: AllQuery
  ) => Promise<number>;

  /**
   * Commits message into stream of aggregate id
   * @param stream stream name
   * @param events array of uncommitted events
   * @param metadata metadata
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @returns array of committed events
   */
  commit: <E extends Messages>(
    stream: string,
    events: Message<E>[],
    metadata: CommittedEventMetadata,
    expectedVersion?: number
  ) => Promise<CommittedEvent<E>[]>;

  /**
   * Gets store stats
   */
  stats: () => Promise<StoreStat[]>;

  /**
   * Polls for new events after stored consumer watermark
   * - Creates an expiring consumer lease to serialize competing consumers
   * - Commits the new watermark after the `ack` response is received within lease time
   * - Rejects `ack` and allows new consumers after lease expires
   * - `consumer` the consumer name
   * - `names` the event names to poll
   * - `limit` the max number of events to poll
   * - `lease` the unique lease id
   * - `timeout` the lease timeout in ms
   * - `callback` the callback with events after consumer stored watermark
   */
  poll: <E extends Messages>(
    consumer: string,
    names: string[],
    limit: number,
    lease: string,
    timeout: number,
    callback: (event: CommittedEvent<E>) => void
  ) => Promise<void>;

  /**
   * Acknowledges when a consumer handled polled events succesfully
   * - `consumer` the consumer name
   * - `lease` the unique lease id to ack
   * - `watermark` the new watermark of consumed events
   * - returns false when ack is rejected due to lease expiration
   * */
  ack: (consumer: string, lease: string, watermark: number) => Promise<boolean>;

  /**
   * Gets current subscription states
   */
  subscriptions: () => Promise<Subscription[]>;
}

export interface SnapshotStore<
  S extends State = State,
  E extends Messages = Messages
> extends Disposable,
    Seedable {
  /**
   * Snapshot threshold
   */
  threshold: number;

  /**
   * Reads snapshot from store for stream
   */
  read: (stream: string) => Promise<Snapshot<S, E>>;

  /**
   * Commits a snapshot into stream for stream
   * @param data the current state to be sotred
   */
  upsert: (stream: string, state: Snapshot<S, E>) => Promise<void>;
}

export interface ProjectorStore<S extends State = State>
  extends Disposable,
    Seedable {
  /**
   * Loads projection records by id
   * @param ids the record ids
   * @returns the stored records by id
   */
  load: (ids: string[]) => Promise<ProjectionRecord<S>[]>;

  /**
   * Commits projection with basic idempotence check
   * @param projection the projection filters
   * @param watermark the new watermark - ignored when new watermark <= stored watermark
   * @returns the projection results
   */
  commit: (
    projection: Projection<S>,
    watermark: number
  ) => Promise<ProjectionResults<S>>;

  /**
   * Queries projection
   * @param query the projection query
   * @param callback the callback receiving results
   * @returns the number of records found
   */
  query: (
    query: ProjectionQuery<S>,
    callback: (record: ProjectionRecord<S>) => void
  ) => Promise<number>;
}
