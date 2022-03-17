import { Subscription } from "./types";

export interface SubscriptionStore {
  /**
   * Store initializer
   */
  init: (seed?: boolean) => Promise<void>;

  /**
   * Store closer
   */
  close: () => Promise<void>;

  /**
   * Loads subscriptions from store
   * @param id optional subscription id
   */
  load: (id?: string) => Promise<Subscription[]>;

  /**
   * Searches subscriptions from store
   * @param pattern search pattern
   */
  search: (pattern: string) => Promise<Subscription[]>;

  /**
   * Creates a new subscription
   * @param sub the subscription
   */
  create: (sub: Subscription) => Promise<void>;

  /**
   * Updates a subscription
   * @param sub the subscription
   */
  update: (sub: Subscription) => Promise<void>;

  /**
   * Deletes a subscription
   * @param id the subscription id
   */
  delete: (id: string) => Promise<void>;

  /**
   * Toggles a subscription (activation)
   * @param id the subscription id
   */
  toggle: (id: string) => Promise<void>;

  /**
   * Commits a new position
   * @param id subscription id
   * @param position new position
   */
  commit: (id: string, position: number) => Promise<void>;
}
