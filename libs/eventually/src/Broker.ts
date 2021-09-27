import { Evt, Payload, Policy } from "./types";

/**
 * Brokers emit committed events to reliable pub/sub topics
 */
export interface Broker {
  /**
   * Creates event topic
   * @param event committed event
   */
  topic(event: Evt): Promise<void>;

  /**
   * Subscribes policy to topic
   * @param policy policy
   * @param event committed event
   */
  subscribe(policy: Policy<unknown, unknown>, event: Evt): Promise<void>;

  /**
   * Emits event to topic
   * @param event committed event
   */
  emit: (event: Evt) => Promise<void>;

  /**
   * Decodes pushed messages
   * @param msg pushed message
   * @returns committed event in payload
   */
  decode: (msg: Payload) => Evt;
}
