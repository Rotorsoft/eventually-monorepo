import { SubscriptionStore } from "../interfaces";
import { Service, Subscription, TriggerCallback } from "../types";

export const InMemorySubscriptionStore = (): SubscriptionStore => {
  const services: Record<string, Service> = {};
  const subscriptions: Record<string, Subscription> = {};
  let _servicesCallback: TriggerCallback;
  let _subscriptionsCallback: TriggerCallback;

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
      service.updated = new Date();
      services[service.id] = service;
      _servicesCallback &&
        _servicesCallback({ operation: "INSERT", id: service.id });
      return Promise.resolve();
    },
    updateService: async (service: Service) => {
      service.updated = new Date();
      services[service.id] = service;
      _servicesCallback &&
        _servicesCallback({ operation: "UPDATE", id: service.id });
      return Promise.resolve();
    },
    deleteService: async (id: string) => {
      delete services[id];
      _servicesCallback && _servicesCallback({ operation: "DELETE", id });
      return Promise.resolve();
    },
    commitServicePosition: (id: string, position: number) => {
      const service = services[id];
      service.position = position;
      service.updated = new Date();
      return Promise.resolve();
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
        _subscriptionsCallback({
          operation: "INSERT",
          id: subscription.id
        });
      return Promise.resolve();
    },
    updateSubscription: async (subscription: Subscription) => {
      subscriptions[subscription.id] = subscription;
      _subscriptionsCallback &&
        _subscriptionsCallback({
          operation: "UPDATE",
          id: subscription.id
        });
      return Promise.resolve();
    },
    deleteSubscription: async (id: string) => {
      delete subscriptions[id];
      _subscriptionsCallback &&
        _subscriptionsCallback({ operation: "DELETE", id });
      return Promise.resolve();
    },
    toggleSubscription: async (id: string) => {
      const sub = subscriptions[id];
      sub.active = !sub.active;
      _subscriptionsCallback &&
        _subscriptionsCallback({ operation: "UPDATE", id });
      return Promise.resolve();
    },
    commitSubscriptionPosition: (id: string, position: number) => {
      const sub = subscriptions[id];
      sub.position = position;
      sub.updated = new Date();
      return Promise.resolve();
    }
  };
};
