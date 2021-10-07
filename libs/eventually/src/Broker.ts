import { Evt, EvtOf, Payload, PolicyFactory } from "./types";

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
   * Emits event to topic
   * @param event committed event
   * @returns the message id
   */
  emit: <E>(event: EvtOf<E>) => Promise<string>;

  /**
   * Decodes pushed messages
   * @param msg pushed message
   * @returns committed event in payload
   */
  decode: (msg: Payload) => Evt;
}
