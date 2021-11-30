import { CommittedEventMetadata } from ".";
import {
  AllQuery,
  CommittedEvent,
  Message,
  Payload,
  Snapshot,
  StoreStat,
  Topic
} from "./types";

/**
 * Brokers publish committed events to pub/sub topics
 */
export interface Broker {
  /**
   * Subscribes url to topic
   * @param name the subscription name
   * @param url the url
   * @param topic the topic
   */
  subscribe(name: string, url: string, topic: Topic): Promise<void>;

  /**
   * Publishes event to topic
   * @param event committed event
   * @param topic the topic
   * @returns the message id
   */
  publish: (
    event: CommittedEvent<string, Payload>,
    topic: Topic
  ) => Promise<string>;

  /**
   * Decodes pushed messages
   * @param msg pushed message
   * @returns committed event in payload
   */
  decode: (msg: Payload) => CommittedEvent<string, Payload>;
}

/**
 * Stores events in streams
 */
export interface Store {
  /**
   * Store initializer
   */
  init: () => Promise<void>;

  /**
   * Store closer
   */
  close: () => Promise<void>;

  /**
   * Queries the event store
   * @param callback callback predicate
   * @param query optional query values
   */
  query: (
    callback: (event: CommittedEvent<string, Payload>) => void,
    query?: AllQuery
  ) => Promise<void>;

  /**
   * Commits message into stream of aggregate id
   * @param stream stream name
   * @param events array of uncommitted events
   * @param metadata metadata
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @param callback optional callback to handle committed events before closing the transaction
   * @returns array of committed events
   */
  commit: (
    stream: string,
    events: Message<string, Payload>[],
    metadata: CommittedEventMetadata,
    expectedVersion?: number,
    callback?: (events: CommittedEvent<string, Payload>[]) => Promise<void>
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
  init: () => Promise<void>;

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
