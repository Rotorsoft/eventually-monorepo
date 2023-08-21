import type {
  AggQuery,
  AggResult,
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Lease,
  Message,
  Messages,
  PollOptions,
  Projection,
  ProjectionMap,
  ProjectionQuery,
  ProjectionRecord,
  ProjectionResults,
  ProjectionSort,
  Schema,
  State,
  StoreStat,
  Subscription
} from "../types";
import { Disposable } from "./generic";

/**
 * Stores events in streams and consumer subscriptions/leases
 */
export interface Store extends Disposable {
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

  /**
   * Gets store stats
   * TODO: refactor stats using async projections
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

  /**
   * Seeds the schemas
   */
  seed: () => Promise<void>;
}

/**
 * Stores projections
 */
export interface ProjectorStore<S extends State = State> extends Disposable {
  /**
   * Loads projection records by id
   * @param ids the record ids
   * @returns the stored records by id
   */
  load: (ids: string[]) => Promise<ProjectionRecord<S>[]>;

  /**
   * Commits projection map with basic idempotence check
   * @param map the projection map
   * @param watermark the new watermark - ignored when new watermark <= stored watermark
   * @returns the projection results
   */
  commit: (
    map: ProjectionMap<S>,
    watermark: number
  ) => Promise<ProjectionResults>;

  /**
   * Queries projection
   * @param query projection query
   * @returns array of records found
   */
  query: (query: ProjectionQuery<S>) => Promise<ProjectionRecord<S>[]>;

  /**
   * Aggregates projection
   * @param query aggregate query
   * @returns aggregate results
   */
  agg: (query: AggQuery<S>) => Promise<AggResult<S>>;

  /**
   * Seeds the schemas
   */
  seed: (
    schema: Schema<Projection<S>>,
    indexes: ProjectionSort<S>[]
  ) => Promise<void>;
}
