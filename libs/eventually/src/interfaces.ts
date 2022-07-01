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
 * Disposable resources
 */
export interface Disposable {
  readonly name: string;
  dispose: Disposer;
}

/**
 * Seedable resources (i.e. to initialize or run store migrations)
 */
export interface Seedable {
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
  author: string;
  license: string;
  dependencies: Record<string, string>;
}

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
