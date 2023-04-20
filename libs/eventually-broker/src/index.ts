/** @module eventually-broker */
import { port } from "@rotorsoft/eventually";
import { VoidPullChannel } from "./channels";
import { PullChannel, SubscriptionStore } from "./interfaces";
import { InMemorySubscriptionStore } from "./adapters";

export * from "./broker";
export * from "./interfaces";
export * from "./types";
export * from "./channels";
export * from "./stores";

export const subscriptions = port(function subscriptions(
  store?: SubscriptionStore
) {
  return store || InMemorySubscriptionStore();
});

export const pullchannel = port(function pullchannel(channel?: PullChannel) {
  return channel || VoidPullChannel();
});
