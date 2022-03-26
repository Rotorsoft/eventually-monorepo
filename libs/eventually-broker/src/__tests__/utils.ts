import { subscriptions } from "..";

export const createService = (id: string): Promise<void> =>
  subscriptions().createService({
    id,
    channel: "pg://channel",
    url: "http://localhost"
  });

export const createSubscription = (
  id: string,
  service: string
): Promise<void> =>
  subscriptions().createSubscription({
    id,
    active: false,
    position: -1,
    producer: service,
    consumer: service,
    path: "/",
    streams: ".*",
    names: ".*"
  });
