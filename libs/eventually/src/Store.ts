import { CommittedEvent, Message, Payload } from "./types";

/**
 * Stores persist event messages into streams correlated by aggregate id
 * - produces committed events
 */
export interface Store {
  /**
   * Loads aggregate in memory by reading stream and reducing model
   * @param id aggregate id
   * @param reducer model reducer
   */
  load: <Events>(
    id: string,
    reducer: (event: CommittedEvent<keyof Events & string, Payload>) => void
  ) => Promise<void>;

  /**
   * Commits message into stream of aggregate id
   * @param id aggregate id
   * @param event event message
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @returns committed event
   */
  commit: <Events>(
    id: string,
    event: Message<keyof Events & string, Payload>,
    expectedVersion?: string
  ) => Promise<CommittedEvent<keyof Events & string, Payload>>;

  /**
   * Subscribes to event
   * @param event the event name
   * @param from optional starting point
   * @returns subscription id
   */
  subscribe: (event: string, from?: number) => Promise<string>;

  /**
   * Polls subscription for new events
   * @param subscription the subscription id
   * @param limit optional max number of events to return
   * @returns events array
   */
  poll: (
    subscription: string,
    limit?: number
  ) => Promise<CommittedEvent<string, Payload>[]>;

  /**
   * Acknowledges events up to id
   * @param subscription the subscription id
   * @param id last event id to acknowledge
   * @returns true on success
   */
  ack: (subscription: string, id: number) => Promise<boolean>;
}
