import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Messages,
  ProjectionResults,
  Projection,
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
 * Consumer subscription
 */
export type Subscription = {
  readonly consumer: string;
  readonly watermark: number;
  readonly lease?: string;
  readonly expires?: Date;
};

/**
 * Consumer lease
 */
export type Lease<E extends Messages> = Subscription & {
  readonly lease: string;
  readonly expires: Date;
  readonly events: CommittedEvent<E>[];
};

/**
 * Poll options
 * - `names` the event names to poll
 * - `timeout` the lease timeout in ms
 * - `limit` the max number of events to poll
 */
export type PollOptions = {
  readonly names: string[];
  readonly timeout: number;
  readonly limit: number;
};

/**
 * Stores events in streams and consumer subscriptions/leases
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
   * Resets the store - TODO: add options to "close the books"
   */
  reset: () => Promise<void>;

  // TODO: refactor stats using async projections
  /**
   * Gets store stats
   */
  stats: () => Promise<StoreStat[]>;

  /**
   * Polls for events after stored consumer watermark
   *
   * > Creates an expiring consumer lease when events are found
   *
   * > This strategy must commit a new watermark with `ack` within the lease time, or new consumer requests will be allowed after lease expires
   *
   * - `consumer` the consumer name
   * - `options` the poll options
   * @returns a new lease when events are found
   */
  poll: <E extends Messages>(
    consumer: string,
    options: PollOptions
  ) => Promise<Lease<E> | undefined>;

  /**
   * Acknowledges when the consumer finishes handling events
   * - `lease` the lease
   * - `watermark?` the new watermark of consumed events
   * - returns false when lease expired
   * */
  ack: <E extends Messages>(
    lease: Lease<E>,
    watermark?: number
  ) => Promise<boolean>;

  /**
   * Gets subscriptions
   */
  subscriptions: () => Promise<Subscription[]>;
}

/**
 * Stores projections
 */
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
