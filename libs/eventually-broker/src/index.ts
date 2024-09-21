/** @module eventually-broker */
import { port } from "@rotorsoft/eventually";
import { InMemorySubscriptionStore } from "./adapters";
import { VoidPullChannel } from "./channels";
import { PullChannel, SubscriptionStore } from "./interfaces";

export * from "./broker";
export * from "./channels";
export * from "./interfaces";
export * from "./stores";
export * from "./types";

export const subscriptions = port(function subscriptions(
  store?: SubscriptionStore
) {
  return store || InMemorySubscriptionStore();
});

export const pullchannel = port(function pullchannel(channel?: PullChannel) {
  return channel || VoidPullChannel();
});
