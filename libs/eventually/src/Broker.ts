import { EvtOf, Evt, Payload, Policy } from "./types";

/**
 * Brokers emit committed events to reliable pub/sub topics
 */
export interface Broker {
  /**
   * Subscribes policy to topic
   * @param name topic name
   * @param event committed event
   */
  subscribe<Commands, Events>(
    policy: Policy<Commands, Events>,
    event: EvtOf<Events>
  ): Promise<void>;

  /**
   * Emits event to topic
   * @param event committed event
   */
  emit: <Events>(event: EvtOf<Events>) => Promise<void>;

  /**
   * Decodes pushed messages
   * @param msg pushed message
   * @returns committed event in payload
   */
  decode: (msg: Payload) => Evt;
}
