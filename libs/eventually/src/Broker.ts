import { Evt, EvtOf, MsgOf, Payload, Policy } from "./types";

/**
 * Brokers emit committed events to reliable pub/sub topics
 */
export interface Broker {
  /**
   * Subscribes policy to topic
   * @param name topic name
   * @param event committed event
   */
  subscribe<C, E>(policy: Policy<C, E>, event: MsgOf<E>): Promise<void>;

  /**
   * Emits event to topic
   * @param event committed event
   */
  emit: <E>(event: EvtOf<E>) => Promise<void>;

  /**
   * Decodes pushed messages
   * @param msg pushed message
   * @returns committed event in payload
   */
  decode: (msg: Payload) => Evt;
}
