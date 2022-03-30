import { CommittedEvent, Payload } from "@rotorsoft/eventually";
import { Service, Subscription, subscriptions } from "..";

export const serviceBody = (
  id: string,
  channel = "pg://channel",
  url = "http://url"
): Service => ({
  id,
  channel,
  url
});

export const subscriptionBody = (
  id: string,
  producer = "s1",
  consumer = "s1"
): Subscription => ({
  id,
  producer,
  consumer,
  path: "path",
  active: false,
  streams: ".*",
  names: ".*",
  position: -1
});

export const createService = (id: string): Promise<void> =>
  subscriptions().createService(serviceBody(id));

export const createSubscription = (
  id: string,
  service: string
): Promise<void> =>
  subscriptions().createSubscription(subscriptionBody(id, service, service));

export const createCommittedEvent = (
  id = 0,
  name = "name",
  stream = "stream"
): CommittedEvent<string, Payload> => ({
  id,
  name,
  stream,
  version: 0,
  created: new Date()
});
