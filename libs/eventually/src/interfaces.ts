import {
  AllQuery,
  CommittedEvent,
  CommittedEventMetadata,
  Disposer,
  Message,
  Payload,
  Seeder,
  Snapshot,
  StoreStat
} from "./types";

/**
 * Disposable resources implement this
 */
export interface Disposable {
  readonly name: string;
  dispose: Disposer;
}

/**
 * Disposable resources implement this
 */
export interface DisposableStore extends Disposable {
  /**
   * Store initializer
   */
  seed: Seeder;
}

/**
 * Environments
 */
export enum Environments {
  development = "development",
  test = "test",
  staging = "staging",
  production = "production"
}

/**
 * Log levels
 */
export enum LogLevels {
  error = "error",
  info = "info",
  trace = "trace"
}

export type Color =
  | "red"
  | "green"
  | "magenta"
  | "blue"
  | "white"
  | "gray"
  | "bgRed"
  | "bgGreen"
  | "bgMagenta"
  | "bgBlue"
  | "bgWhite";

/**
 * Logger
 */
export interface Log extends Disposable {
  trace(color: Color, message: string, ...params: any[]): void;
  info(color: Color, message: string, ...params: any[]): void;
  error(error: unknown): void;
}

/**
 * Base configuration
 */
export interface Config extends Disposable {
  env: Environments;
  host: string;
  port: number;
  logLevel: LogLevels;
  service: string;
  version: string;
  description: string;
}

/**
 * Stores events in streams
 */
export interface Store extends DisposableStore {
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
  seed: () => Promise<void>;

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
