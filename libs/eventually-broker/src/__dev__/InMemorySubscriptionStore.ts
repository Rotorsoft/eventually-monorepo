import { SubscriptionStore } from "../interfaces";
import { Service, Subscription, TriggerCallback } from "../types";

export const InMemorySubscriptionStore = (): SubscriptionStore => {
  const services: Record<string, Service> = {};
  const subscriptions: Record<string, Subscription> = {};
  const callbacks: Record<string, TriggerCallback> = {};

  const findSubscriptionById = (id: string): Subscription[] =>
    Object.values(subscriptions).filter((s) => s.id === id);

  return {
    seed: () => undefined,
    listen: (stream, callback) => {
      callbacks[stream] = callback;
      return Promise.resolve();
    },
    loadServices: () => Promise.resolve(Object.values(services)),
    createService: async (service: Service) => {
      services[service.id] = service;
      const callback = callbacks["services"];
      callback && (await callback({ operation: "INSERT", id: service.id }));
    },
    updateService: async (service: Service) => {
      services[service.id] = service;
      const callback = callbacks["services"];
      callback && (await callback({ operation: "UPDATE", id: service.id }));
    },
    deleteService: async (id: string) => {
      delete services[id];
      const callback = callbacks["services"];
      callback && (await callback({ operation: "DELETE", id }));
    },
    loadSubscriptions: () => Promise.resolve(Object.values(subscriptions)),
    loadSubscriptionsByProducer: (producer: string) =>
      Promise.resolve(
        Object.values(subscriptions).filter((s) => s.producer === producer)
      ),
    searchSubscriptions: () => Promise.resolve(Object.values(subscriptions)),
    createSubscription: async (subscription: Subscription) => {
      subscriptions[subscription.id] = subscription;
      const callback = callbacks["subscriptions"];
      callback &&
        (await callback({
          operation: "INSERT",
          id: subscription.id
        }));
    },
    updateSubscription: async (subscription: Subscription) => {
      subscriptions[subscription.id] = subscription;
      const callback = callbacks["subscriptions"];
      callback &&
        (await callback({
          operation: "UPDATE",
          id: subscription.id
        }));
    },
    deleteSubscription: async (id: string) => {
      delete subscriptions[id];
      const callback = callbacks["subscriptions"];
      callback && (await callback({ operation: "DELETE", id }));
    },
    toggleSubscription: async (id: string) => {
      const [found] = findSubscriptionById(id);
      found && (found.active = !found.active);
      const callback = callbacks["subscriptions"];
      callback && (await callback({ operation: "UPDATE", id }));
    },
    commitPosition: (id: string, position: number) => {
      const [found] = findSubscriptionById(id);
      found && (found.position = position);
      return Promise.resolve();
    }
  };
};
