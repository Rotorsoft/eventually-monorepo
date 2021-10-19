import { AllQuery, ProcessManagerFactory, Snapshot } from ".";
import { Evt, Msg, Payload, PolicyFactory } from "./types";

/**
 * Brokers publish committed events to pub/sub topics
 */
export interface Broker {
  /**
   * Subscribes event handler to topic
   * @param factory event handler factory
   * @param event committed event
   */
  subscribe(
    factory:
      | PolicyFactory<unknown, unknown>
      | ProcessManagerFactory<Payload, unknown, unknown>,
    event: Evt
  ): Promise<void>;

  /**
   * Publishes event to topic
   * @param event committed event
   * @returns the message id
   */
  publish: (event: Evt) => Promise<string>;

  /**
   * Decodes pushed messages
   * @param msg pushed message
   * @returns committed event in payload
   */
  decode: (msg: Payload) => Evt;
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
  query: (callback: (event: Evt) => void, query?: AllQuery) => Promise<void>;

  /**
   * Commits message into stream of aggregate id
   * @param stream stream name
   * @param events array of uncommitted events
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @param callback optional callback to handle committed events before closing the transaction
   * @returns array of committed events
   */
  commit: (
    stream: string,
    events: Msg[],
    expectedVersion?: number,
    callback?: (events: Evt[]) => Promise<void>
  ) => Promise<Evt[]>;
}

export type SnapshotStore = {
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