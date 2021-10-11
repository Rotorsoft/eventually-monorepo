import { ProcessManagerFactory } from ".";
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
   * Loads events from store
   * @param callback callback predicate
   * @param stream optional stream filter
   * @param name optional event name filter
   * @param after optional starting point - defaults to -1
   * @param limit optional limit of events to return
   */
  read: (
    callback: (event: Evt) => void,
    options?: { stream?: string; name?: string; after?: number; limit?: number }
  ) => Promise<void>;

  /**
   * Commits message into stream of aggregate id
   * @param stream stream name
   * @param events array of uncommitted events
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @param publish flag to publish committed events before closing the transaction - "at-least-once" delivery
   * @returns array of committed events
   */
  commit: (
    stream: string,
    events: Msg[],
    expectedVersion?: number,
    publish?: boolean
  ) => Promise<Evt[]>;
}
