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
   * Gets store stats
   * TODO: refactor stats using async projections
   */
  stats: () => Promise<StoreStat[]>;

  /**
   * Seeds the store
   */
  seed: () => Promise<void>;

  /**
   * Drops the store
   */
  drop: () => Promise<void>;
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
   * Seeds the store
   */
  seed: (
    schema: Schema<Projection<S>>,
    indexes: ProjectionSort<S>[]
  ) => Promise<void>;

  /**
   * Drops the store
   */
  drop: () => Promise<void>;
}

/**
 * Stores subscriptions
 * - Poll: When no active lease found, creates new consumer lease if events are found after watermark
 * - Ack: Updates watermark if received before lease expiration
 */
export interface SubscriptionStore extends Disposable {
  /**
   * Polls the store for events created after a watermark
   * @param consumer consumer name
   * @param options poll options
   * @returns a new lease when events are found
   */
  poll: <E extends Messages>(
    consumer: string,
    options: PollOptions
  ) => Promise<Lease<E> | undefined>;

  /**
   * Acknowledges consumer handling events on active lease
   * @param lease active lease
   * @param watermark new watermark poiting to the last consumed event
   * @returns false when lease expired
   */
  ack: <E extends Messages>(
    lease: Lease<E>,
    watermark: number
  ) => Promise<boolean>;

  /**
   * Gets stored subscriptions
   */
  subscriptions: () => Promise<Subscription[]>;

  /**
   * Seeds the store
   */
  seed: () => Promise<void>;

  /**
   * Drops the store
   */
  drop: () => Promise<void>;
}

/**
 * High throughput FIFO message queue supporting multiple concurrent producers and
 * a controlled dequeuing process guaranteeing at-least-once ordered delivery to consumers of the same stream.
 *
 * Adapters should implement mechanisms to ensure message ordering and delivery guarantees.
 */
export interface MessageQueue<M extends Messages> extends Disposable {
  /**
   * Enqueues messages
   * @param messages the messages
   */
  enqueue: (messages: Message<M>[]) => Promise<void>;

  /**
   * Dequeues message on top of the queue after being processed by consumer callback
   * @param callback consumer callback that receives the message with storage attributes {id, created} and returns a promise or error
   * @param opts optional options for dequeuing
   * @param opts.stream optional stream name to support independent concurrent consumers
   * @param opts.leaseMillis optional lease duration in milliseconds before lock expires (default: 30000)
   * @returns promise that resolves true when message is successfully processed, resolves false when stream is empty or lock cannot be acquired, rejects when message is not processed
   */
  dequeue: (
    callback: (
      message: Message<M> & { id: number | string; created: Date }
    ) => Promise<void>,
    opts?: { 
      stream?: string;
      leaseMillis?: number;
    }
  ) => Promise<boolean>;

  /**
   * Seeds the store
   */
  seed: () => Promise<void>;

  /**
   * Drops the store
   */
  drop: () => Promise<void>;
}
