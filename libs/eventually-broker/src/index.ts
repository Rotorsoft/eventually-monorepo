import { singleton } from "@rotorsoft/eventually";
import { SubscriptionStore } from "./interfaces";
import { InMemorySubscriptionStore } from "./__dev__";

export * from "./broker";
export * from "./interfaces";
export * from "./types";
export * from "./channels";
export * from "./listeners";

export const subscriptions = singleton(function subscriptions(
  store?: SubscriptionStore
) {
  return store || InMemorySubscriptionStore();
});
