import { randomUUID } from "crypto";
import type { SubscriptionStore } from "../interfaces";
import { store } from "../ports";
import {
  type CommittedEvent,
  type Lease,
  type Messages,
  type PollOptions,
  type Subscription
} from "../types";

/**
 * @category Adapters
 * @remarks In-memory subscription store
 */
export const InMemorySubscriptionStore = (): SubscriptionStore => {
  let _subscriptions: Record<string, Subscription> = {};

  return {
    name: "InMemorySubscriptionStore",
    dispose: () => {
      _subscriptions = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    drop: (): Promise<void> => {
      _subscriptions = {};
      return Promise.resolve();
    },

    poll: async <E extends Messages>(
      consumer: string,
      { names, timeout, limit }: PollOptions
    ): Promise<Lease<E> | undefined> => {
      const subscription: Subscription = (_subscriptions[consumer] =
        _subscriptions[consumer] || { consumer, watermark: -1 });

      // blocks competing consumers while existing lease is valid
      if (
        !(
          subscription.lease &&
          subscription.expires &&
          subscription.expires > new Date()
        )
      ) {
        // get events after watermark
        const events: Array<CommittedEvent<E>> = [];
        await store().query<E>((e) => events.push(e), {
          after: subscription.watermark,
          limit,
          names
        });

        // create a new lease when events found
        if (events.length) {
          const renew: Subscription = {
            consumer,
            watermark: subscription.watermark,
            lease: randomUUID(),
            expires: new Date(Date.now() + timeout)
          };
          _subscriptions[consumer] = renew;
          return { ...renew, events } as Lease<E>;
        }
      }
    },

    ack: <E extends Messages>(lease: Lease<E>, watermark: number) => {
      const subscription = _subscriptions[lease.consumer];
      // updates subscription while lease is still valid
      if (
        subscription &&
        subscription.lease &&
        subscription.lease === lease.lease &&
        subscription.expires &&
        subscription.expires > new Date()
      ) {
        _subscriptions[lease.consumer] = {
          consumer: lease.consumer,
          watermark
        };
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    },

    subscriptions: () => Promise.resolve(Object.values(_subscriptions))
  };
};
