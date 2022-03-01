import { SubscriptionStore } from "../interfaces";
import { Subscription } from "../types";

export const InMemorySubscriptionStore = (): SubscriptionStore => {
  return {
    init: (): Promise<void> => {
      return;
    },

    close: (): Promise<void> => {
      return;
    },

    load: (): Promise<Subscription[]> => {
      throw Error("Not Implemented");
    },

    commit: (): Promise<void> => {
      throw Error("Not Implemented");
    }
  };
};
