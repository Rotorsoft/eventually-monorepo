import { Seedable, Disposable } from "./generic";
import {
  CommittedEvent,
  CommittedEventMetadata,
  CommittedEventWithSource,
  Message,
  Payload
} from "../types/message";
import { AllQuery, Projection } from "../types/query";
import { StoreStat } from "../types/generic";
import { Snapshot } from "../types/command";

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

/**
 * Stores aggregate snapshots
 */
export interface SnapshotStore extends Disposable, Seedable {
  /**
   * Reads a snapshot from store
   * @param stream the stream
   * @returns the existing snapshot
   */
  read: <M extends Payload>(stream: string) => Promise<Snapshot<M>>;

  /**
   * Commits a snapshot into a stream
   * @param stream the stream
   * @param data the current state to be stored
   */
  upsert: <M extends Payload>(
    stream: string,
    data: Snapshot<M>
  ) => Promise<void>;
}

/**
 * Stores projections
 */
export interface ProjectionStore extends Disposable, Seedable {
  /**
   * Loads projection from store
   * @param event the event being projected next with source
   * @returns the existing projection
   */
  load: <M extends Payload>(
    event: CommittedEventWithSource
  ) => Promise<Projection<M>>;

  /**
   * Commits new projection state and updates source watermak
   * @param event the newly projected event with source
   * @returns the new projection with udpated watermark
   */
  commit: <M extends Payload>(
    event: CommittedEventWithSource,
    state: M
  ) => Promise<Projection<M>>;

  /**
   * TODO: Queries the store with filter and pagination options
   */
  query: <M extends Payload>() => Promise<Array<Readonly<M>>>;
}
