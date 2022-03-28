import { SubscriptionStore } from "../interfaces";

export const InMemorySubscriptionStore = (): SubscriptionStore => {
  return {
    seed: () => {
      throw Error("Not Implemented");
    },
    listen: () => {
      throw Error("Not Implemented");
    },
    loadServices: () => {
      throw Error("Not Implemented");
    },
    createService: () => {
      throw Error("Not Implemented");
    },
    updateService: () => {
      throw Error("Not Implemented");
    },
    deleteService: () => {
      throw Error("Not Implemented");
    },
    loadSubscriptions: () => {
      throw Error("Not Implemented");
    },
    loadSubscriptionsByProducer: () => {
      throw Error("Not Implemented");
    },
    searchSubscriptions: () => {
      throw Error("Not Implemented");
    },
    createSubscription: () => {
      throw Error("Not Implemented");
    },
    updateSubscription: () => {
      throw Error("Not Implemented");
    },
    deleteSubscription: () => {
      throw Error("Not Implemented");
    },
    toggleSubscription: () => {
      throw Error("Not Implemented");
    },
    commitPosition: () => {
      throw Error("Not Implemented");
    }
  };
};
