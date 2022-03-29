import { SubscriptionStore } from "../interfaces";
import { Service, Subscription } from "../types";

export const InMemorySubscriptionStore = (): SubscriptionStore => {
  const services: Record<string, Service> = {};
  const subscriptions: Record<string, Subscription> = {};

  const findSubscriptionById = (id: string): Subscription[] =>
    Object.values(subscriptions).filter((s) => s.id === id);

  return {
    seed: () => undefined,
    listen: () => undefined,
    loadServices: () => Promise.resolve(Object.values(services)),
    createService: (service: Service) => {
      services[service.id] = service;
      return Promise.resolve();
    },
    updateService: (service: Service) => {
      services[service.id] = service;
      return Promise.resolve();
    },
    deleteService: (id: string) => {
      delete services[id];
      return Promise.resolve();
    },
    loadSubscriptions: () => Promise.resolve(Object.values(subscriptions)),
    loadSubscriptionsByProducer: (producer: string) =>
      Promise.resolve(
        Object.values(subscriptions).filter((s) => s.producer === producer)
      ),
    searchSubscriptions: () => Promise.resolve(Object.values(subscriptions)),
    createSubscription: (subscription: Subscription) => {
      subscriptions[subscription.id] = subscription;
      return Promise.resolve();
    },
    updateSubscription: (subscription: Subscription) => {
      subscriptions[subscription.id] = subscription;
      return Promise.resolve();
    },
    deleteSubscription: (id: string) => {
      delete subscriptions[id];
      return Promise.resolve();
    },
    toggleSubscription: (id: string) => {
      const [found] = findSubscriptionById(id);
      found && (found.active = !found.active);
      return Promise.resolve();
    },
    commitPosition: (id: string, position: number) => {
      const [found] = findSubscriptionById(id);
      found && (found.position = position);
      return Promise.resolve();
    }
  };
};
