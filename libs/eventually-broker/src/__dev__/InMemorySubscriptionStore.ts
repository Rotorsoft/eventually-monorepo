import { SubscriptionStore } from "../interfaces";
import { Service, Subscription, TriggerCallback } from "../types";

export const InMemorySubscriptionStore = (): SubscriptionStore => {
  const services: Record<string, Service> = {};
  const subscriptions: Record<string, Subscription> = {};
  let _servicesCallback: TriggerCallback;
  let _subscriptionsCallback: TriggerCallback;

  const findSubscriptionById = (id: string): Subscription[] =>
    Object.values(subscriptions).filter((s) => s.id === id);

  return {
    name: "InMemorySubscriptionStore",
    dispose: () => undefined,
    seed: () => undefined,
    listen: (servicesCallback, subscriptionsCallback) => {
      _servicesCallback = servicesCallback;
      _subscriptionsCallback = subscriptionsCallback;
    },
    loadServices: () => Promise.resolve(Object.values(services)),
    createService: async (service: Service) => {
      services[service.id] = service;
      _servicesCallback &&
        (await _servicesCallback({ operation: "INSERT", id: service.id }));
    },
    updateService: async (service: Service) => {
      services[service.id] = service;
      _servicesCallback &&
        (await _servicesCallback({ operation: "UPDATE", id: service.id }));
    },
    deleteService: async (id: string) => {
      delete services[id];
      _servicesCallback &&
        (await _servicesCallback({ operation: "DELETE", id }));
    },
    loadSubscriptions: () => Promise.resolve(Object.values(subscriptions)),
    loadSubscriptionsByProducer: (producer: string) =>
      Promise.resolve(
        Object.values(subscriptions).filter((s) => s.producer === producer)
      ),
    searchSubscriptions: () => Promise.resolve(Object.values(subscriptions)),
    createSubscription: async (subscription: Subscription) => {
      subscriptions[subscription.id] = subscription;
      _subscriptionsCallback &&
        (await _subscriptionsCallback({
          operation: "INSERT",
          id: subscription.id
        }));
    },
    updateSubscription: async (subscription: Subscription) => {
      subscriptions[subscription.id] = subscription;
      _subscriptionsCallback &&
        (await _subscriptionsCallback({
          operation: "UPDATE",
          id: subscription.id
        }));
    },
    deleteSubscription: async (id: string) => {
      delete subscriptions[id];
      _subscriptionsCallback &&
        (await _subscriptionsCallback({ operation: "DELETE", id }));
    },
    toggleSubscription: async (id: string) => {
      const [found] = findSubscriptionById(id);
      found && (found.active = !found.active);
      _subscriptionsCallback &&
        (await _subscriptionsCallback({ operation: "UPDATE", id }));
    },
    commitPosition: (id: string, position: number) => {
      const [found] = findSubscriptionById(id);
      found && (found.position = position);
      return Promise.resolve();
    }
  };
};
