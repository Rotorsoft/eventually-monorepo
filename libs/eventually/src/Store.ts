import { EvtOf, Evt, MsgOf } from "./types";

/**
 * Stores persist event messages into streams correlated by aggregate id
 * - produces committed events
 */
export interface Store {
  /**
   * Store initializer
   */
  init?: () => Promise<void>;

  /**
   * Loads aggregate in memory by reading stream and reducing model
   * @param id aggregate id
   * @param reducer model reducer
   */
  load: <E>(id: string, reducer: (event: EvtOf<E>) => void) => Promise<void>;

  /**
   * Commits message into stream of aggregate id
   * @param id aggregate id
   * @param events array of uncommitted events
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @returns array of committed events
   */
  commit: <E>(
    id: string,
    events: MsgOf<E>[],
    expectedVersion?: string
  ) => Promise<EvtOf<E>[]>;

  /**
   * Loads events from stream
   * @param name optional event name filter
   * @param after optional starting point - defaults to -1
   * @param limit optional max number of events to return - defaults to 1
   * @returns events array
   */
  read: (name?: string, after?: number, limit?: number) => Promise<Evt[]>;
}
