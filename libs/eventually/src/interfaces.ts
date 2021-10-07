import { Evt, EvtOf, MsgOf, Payload, PolicyFactory } from "./types";

/**
 * Brokers emit committed events to reliable pub/sub topics
 */
export interface Broker {
  /**
   * Creates event topic
   * @param event committed event
   */
  topic<E>(event: EvtOf<E>): Promise<void>;

  /**
   * Subscribes policy to topic
   * @param factory policy factory
   * @param event committed event
   */
  subscribe<C, E, M extends Payload>(
    factory: PolicyFactory<C, E, M>,
    event: EvtOf<E>
  ): Promise<void>;

  /**
   * Publishes event to topic
   * @param event committed event
   * @returns the message id
   */
  publish: <E>(event: EvtOf<E>) => Promise<string>;

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
  read: <E>(
    callback: (event: EvtOf<E>) => void,
    options?: { stream?: string; name?: string; after?: number; limit?: number }
  ) => Promise<void>;

  /**
   * Commits message into stream of aggregate id
   * @param stream stream name
   * @param events array of uncommitted events
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @param broker optional broker to publish committed events before closing the transaction
   * @returns array of committed events
   */
  commit: <E>(
    stream: string,
    events: MsgOf<E>[],
    expectedVersion?: string,
    broker?: Broker
  ) => Promise<EvtOf<E>[]>;
}
