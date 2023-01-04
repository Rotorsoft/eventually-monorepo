import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Messages,
  ProjectionResponse,
  Snapshot,
  SnapshotsQuery,
  State
} from "../types/messages";
import { Disposable, Seedable } from "./generic";

export type StoreStat = {
  name: string;
  count: number;
  firstId?: number;
  lastId?: number;
  firstCreated?: Date;
  lastCreated?: Date;
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
  query: (
    callback: (event: CommittedEvent) => void,
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
    events: Message[],
    metadata: CommittedEventMetadata,
    expectedVersion?: number,
    notify?: boolean
  ) => Promise<CommittedEvent[]>;

  /**
   * Gets store stats
   */
  stats: () => Promise<StoreStat[]>;
}

export interface SnapshotStore extends Disposable, Seedable {
  /**
   * Reads snapshot from store for stream
   */
  read: <S extends State, E extends Messages>(
    stream: string
  ) => Promise<Snapshot<S, E>>;

  /**
   * Commits a snapshot into stream for stream
   * @param data the current state to be sotred
   */
  upsert: <S extends State, E extends Messages>(
    stream: string,
    state: Snapshot<S, E>
  ) => Promise<void>;

  /**
   * Queries the snapshot store
   * @param query query parameters
   * @returns array of snapshots
   */
  query: <S extends State, E extends Messages>(
    query: SnapshotsQuery
  ) => Promise<Snapshot<S, E>[]>;
}

export interface ProjectorStore extends Disposable, Seedable {
  /**
   * Loads a projection
   * @param id the projection id
   * @returns the stored projection response
   */
  load: <S extends State>(
    id: string
  ) => Promise<ProjectionResponse<S> | undefined>;

  /**
   * Commits a new projection
   * @param id the projection id
   * @param state the projected state
   * @param expectedWatermark expected watermark for optimistic concurrency and idempotence management
   * @param newWatermark new watermark to be stored on success
   * @returns the stored projection response
   */
  commit: <S extends State>(
    id: string,
    state: S,
    expectedWatermark: number,
    newWatermark: number
  ) => Promise<ProjectionResponse<S>>;
}
