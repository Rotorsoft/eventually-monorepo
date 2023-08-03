import { CommittedEvent, Disposable, Payload } from "@andela-technology/eventually";
import {
  PullOptions,
  PushEvent,
  Service,
  Subscription,
  TriggerCallback
} from "./types";

/**
 * Listens for changes in streams
 */
export interface StreamListener {
  listen: (callback: TriggerCallback) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Pull channels pull events from streams
 */
export interface PullChannel extends Disposable {
  label: string;
  listen: (callback: TriggerCallback) => Promise<void>;
  pull: (options: PullOptions) => Promise<CommittedEvent[]>;
}

/**
 * Push channels push events to consumer endpoints
 */

export interface PushChannel {
  label: string;
  init: () => Promise<void>;
  push: (events: PushEvent[]) => Promise<number>;
}

/**
 * Maps protocols to channel factories
 */
export interface ChannelResolvers {
  pull: Record<string, (url: URL, id: string) => PullChannel>;
  push: Record<
    string,
    (url: URL, id: string, source: string, headers?: Payload) => PushChannel
  >;
}

/**
 * Implements subscription store
 */
export interface SubscriptionStore extends Disposable {
  /**
   * Store initializer
   * @returns a stream listener factory for this store
   */
  seed: () => Promise<void>;

  /**
   * Starts listening for changes in services and subscriptions
   */
  listen: (
    servicesCallback: TriggerCallback,
    subscriptionsCallback: TriggerCallback
  ) => void;

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
   * Commits a new channel position
   * @param id service id
   * @param position new position
   */
  commitServicePosition: (id: string, position: number) => Promise<void>;

  /**
   * Loads subscriptions from store
   * @param id optional subscription id
   */
  loadSubscriptions: (id?: string) => Promise<Subscription[]>;

  /**
   * Loads subscriptions by producer
   * @param producer the producer name
   */
  loadSubscriptionsByProducer: (producer: string) => Promise<Subscription[]>;

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
   * Commits a new subscription position
   * @param id subscription id
   * @param position new position
   */
  commitSubscriptionPosition: (id: string, position: number) => Promise<void>;
}
