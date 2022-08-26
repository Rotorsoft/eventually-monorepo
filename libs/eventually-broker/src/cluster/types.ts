import { PushChannel } from "../interfaces";
import {
  ExtendedSchemaObject,
  Operation,
  Subscription,
  TriggerPayload
} from "../types";

// 404 - Not Found
// 429 - Too Many Requests
// 503 - Service Unavailable
// 504 - Gateway Timeout
export const RetryableHttpStatus = [404, 429, 503, 504];

// 200 - Ok
// 201 - Created
// 204 - No Content (Ignored by RegEx filters)
export const CommittableHttpStatus = [200, 201, 204];

export type EventStats = { count: number; min: number; max: number };

export type SubscriptionStats = {
  batches: number;
  total: number;
  events: Record<string, Record<number, EventStats>>;
};

export type Color = "success" | "warning" | "danger";
export type Icon = "bi-cone-striped" | "bi-activity" | "";

export type EndpointStatus = {
  name?: string;
  code?: number;
  color: Color;
  icon: Icon;
  status?: string;
  error?: {
    messages: string[];
    trigger?: string;
    position?: number;
  };
};

export type SubscriptionState = {
  id: string;
  producer: string;
  consumer: string;
  path: string;
  active: boolean;
  endpoint: string;
  position: number;
  batchSize: number;
  retries: number;
  retryTimeoutSecs: number;
  pushChannel: PushChannel;
  streamsRegExp: RegExp;
  namesRegExp: RegExp;
  stats: SubscriptionStats;
  endpointStatus: EndpointStatus;
};

export type WorkerConfig = {
  id: string;
  workerId: number;
  channel: string;
  subscriptions: Record<string, Subscription>;
  runs: number;
};

export type ErrorMessage = {
  message: string;
};

export type MasterMessage = {
  operation: Operation;
  sub: Subscription;
};

export type WorkerMessage = {
  error?: ErrorMessage;
  state?: SubscriptionState;
  trigger?: TriggerPayload;
};

export type EventsViewModel = {
  name: string;
  found: boolean;
  ok: EventStats;
  ignored: EventStats;
  retryable: EventStats;
  critical: EventStats;
};

export type SubscriptionViewModel = {
  id: string;
  active: boolean;
  position: number;
  channelStatus: string;
  channelPosition: number;
  endpointStatus: EndpointStatus;
  total: number;
  events: EventsViewModel[];
};

export type ContractsViewModel = {
  events: ExtendedSchemaObject[];
};
