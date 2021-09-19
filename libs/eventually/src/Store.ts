import { CommittedEvent, Message, Payload } from "./core";

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
  load: (
    id: string,
    reducer: (event: CommittedEvent<string, Payload>) => void
  ) => Promise<void>;

  /**
   * Commits message into stream of aggregate id
   * @param id aggregate id
   * @param event event message
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @returns committed event
   */
  commit: (
    id: string,
    event: Message<string, Payload>,
    expectedVersion?: string
  ) => Promise<CommittedEvent<string, Payload>>;
}
