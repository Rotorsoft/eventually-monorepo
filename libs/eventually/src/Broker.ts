import { AxiosResponse } from "axios";
import { CommandHandler, CommittedEvent, EventHandler, Message } from "./core";

/**
 * **TODO** Brokers message exchanges between services
 */
export interface Broker {
  /**
   * Subscribes an event handler to an event
   * @param event The event and service path to be subscribed
   */
  subscribe: (
    event: CommittedEvent<string, any>,
    factory: () => { name: () => string } & EventHandler<any, any>,
    path: string
  ) => Promise<void>;

  /**
   * Emits events to subscribed services
   * @param event A committed event to be emitted
   */
  emit(event: CommittedEvent<string, any>): Promise<void>;

  /**
   * Request body adapter
   * @param body The body in a POST request
   */
  body(body: any): any;

  /**
   * Sends a command to a routed service
   * @param command The command instance
   */
  send(
    command: Message<string, any>,
    factory: (id: string) => CommandHandler<any, any, any>,
    path: string,
    id: string,
    expectedVersion?: string
  ): Promise<AxiosResponse | [any, CommittedEvent<string, any>]>;
}
