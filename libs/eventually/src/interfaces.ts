import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Payload,
  Snapshot,
  StoreStat,
  Subscription,
  TriggerCallback
} from "./types";

/**
 * Stores events in streams
 */
export interface Store {
  /**
   * Store initializer
   */
  init: (seed?: boolean) => Promise<void>;

  /**
   * Store closer
   */
  close: () => Promise<void>;

  /**
   * Queries the event store
   * @param callback callback predicate
   * @param query optional query values
   * @returns number of records
   */
  query: (
    callback: (event: CommittedEvent<string, Payload>) => void,
    query?: AllQuery
  ) => Promise<number>;

  /**
   * Commits message into stream of aggregate id
   * @param stream stream name
   * @param events array of uncommitted events
   * @param metadata metadata
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @param notify optional flag to notify event handlers
   * @returns array of committed events
   */
  commit: (
    stream: string,
    events: Message<string, Payload>[],
    metadata: CommittedEventMetadata,
    expectedVersion?: number,
    notify?: boolean
  ) => Promise<CommittedEvent<string, Payload>[]>;

  /**
   * Gets store stats
   */
  stats: () => Promise<StoreStat[]>;
}

export interface SnapshotStore {
  /**
   * Store initializer
   */
  init: (seed?: boolean) => Promise<void>;

  /**
   * Store closer
   */
  close: () => Promise<void>;

  /**
   * Reads snapshot from store for stream
   */
  read: <M extends Payload>(stream: string) => Promise<Snapshot<M>>;

  /**
   * Commits a snapshot into stream for stream
   * @param data the current state to be sotred
   */
  upsert: <M extends Payload>(
    stream: string,
    data: Snapshot<M>
  ) => Promise<void>;
}

export interface SubscriptionStore {
  /**
   * Store initializer
   */
  init: (seed?: boolean) => Promise<void>;

  /**
   * Starts subscription listener
   */
  listen: (
    subscription: Subscription,
    callback: TriggerCallback
  ) => Promise<void>;

  /**
   * Store closer
   */
  close: () => Promise<void>;

  /**
   * Loads subscriptions from store
   * @param id optional subscription id
   */
  load: (id?: string) => Promise<Subscription[]>;

  /**
   * Commits a new position
   * @param id subscription id
   * @param position new position
   */
  commit: (id: string, position: number) => Promise<void>;
}
