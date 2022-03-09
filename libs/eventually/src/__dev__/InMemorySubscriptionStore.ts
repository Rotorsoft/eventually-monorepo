import { SubscriptionStore } from "../interfaces";
import { Subscription } from "../types";

export const InMemorySubscriptionStore = (): SubscriptionStore => {
  return {
    init: (): Promise<void> => {
      throw Error("Not Implemented");
    },

    close: (): Promise<void> => {
      throw Error("Not Implemented");
    },

    load: (): Promise<Subscription[]> => {
      throw Error("Not Implemented");
    },

    commit: (): Promise<void> => {
      throw Error("Not Implemented");
    }
  };
};
