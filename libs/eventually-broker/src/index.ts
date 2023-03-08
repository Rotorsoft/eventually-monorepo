/** @module eventually-broker */
import { singleton } from "@rotorsoft/eventually";
import { VoidPullChannel } from "./channels";
import { PullChannel, SubscriptionStore } from "./interfaces";
import { InMemorySubscriptionStore } from "./adapters";

export * from "./broker";
export * from "./interfaces";
export * from "./types";
export * from "./channels";
export * from "./stores";
export * from "./breaker";

export const subscriptions = singleton(function subscriptions(
  store?: SubscriptionStore
) {
  return store || InMemorySubscriptionStore();
});

export const pullchannel = singleton(function pullchannel(
  channel?: PullChannel
) {
  return channel || VoidPullChannel();
});
