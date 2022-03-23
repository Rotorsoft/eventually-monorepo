import { Service, StreamListenerFactory, Subscription } from "./types";

export interface SubscriptionStore {
  /**
   * Store initializer
   * @returns a stream listener factory for this store
   */
  init: (seed?: boolean) => Promise<StreamListenerFactory>;

  /**
   * Store closer
   */
  close: () => Promise<void>;

  /**
   * Loads services from store
   * @param id optional service id
   */
  loadServices: (id?: string) => Promise<Service[]>;

  /**
   * Creates a new service
   * @param service the service
   */
  createService: (service: Service) => Promise<void>;

  /**
   * Updates a service
   * @param service the service
   */
  updateService: (service: Service) => Promise<void>;

  /**
   * Deletes a service
   * @param id the service id
   */
  deleteService: (id: string) => Promise<void>;

  /**
   * Loads subscriptions from store
   * @param id optional subscription id
   */
  loadSubscriptions: (id?: string) => Promise<Subscription[]>;

  /**
   * Searches subscriptions from store
   * @param pattern search pattern
   */
  searchSubscriptions: (pattern: string) => Promise<Subscription[]>;

  /**
   * Creates a new subscription
   * @param sub the subscription
   */
  createSubscription: (sub: Subscription) => Promise<void>;

  /**
   * Updates a subscription
   * @param sub the subscription
   */
  updateSubscription: (sub: Subscription) => Promise<void>;

  /**
   * Deletes a subscription
   * @param id the subscription id
   */
  deleteSubscription: (id: string) => Promise<void>;

  /**
   * Toggles a subscription (activation)
   * @param id the subscription id
   */
  toggleSubscription: (id: string) => Promise<void>;

  /**
   * Commits a new position
   * @param id subscription id
   * @param position new position
   */
  commitPosition: (id: string, position: number) => Promise<void>;
}
