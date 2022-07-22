import { Seedable, Disposable } from "./generic";
import {
  CommittedEvent,
  CommittedEventMetadata,
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

/**
 * Stores projections
 */
export interface ProjectionStore<M extends Payload>
  extends Disposable,
    Seedable {
  load: (
    event: CommittedEvent<string, Payload> & { source: string }
  ) => Promise<Projection<M>>;
  commit: (
    projection: Projection<M>,
    event: CommittedEvent<string, Payload> & { source: string }
  ) => Promise<Projection<M>>;
}
