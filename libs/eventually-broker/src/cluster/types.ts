import { PushChannel } from "../interfaces";
import { Operation, Subscription, TriggerPayload } from "../types";

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
export type SubscriptionState = {
  id: string;
  active: boolean;
  endpoint: string;
  position: number;
  batchSize: number;
  retries: number;
  retryTimeoutSecs: number;
  pushChannel: PushChannel;
  streamsRegExp: RegExp;
  namesRegExp: RegExp;
  pumping: boolean;
  retryTimeout?: NodeJS.Timeout;
  stats: SubscriptionStats;
  endpointStatus: {
    name?: string;
    code?: number;
    color: Color;
    icon: Icon;
  };
  errorMessage: string;
  errorPosition: number;
};

export type SubscriptionWithEndpoint = Subscription & { endpoint: string };

export type ChannelConfig = {
  id: string;
  channel: string;
  subscriptions: Record<string, SubscriptionWithEndpoint>;
  runs: number;
  status: string;
};

export type ErrorMessage = {
  message: string;
  state?: SubscriptionState;
};

export type MasterMessage = {
  operation: Operation;
  sub: SubscriptionWithEndpoint;
};

export type WorkerMessage = {
  error?: ErrorMessage;
  state?: SubscriptionState;
  trigger?: TriggerPayload;
};

export type EventsViewModel = {
  name: string;
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
  endpointStatus: {
    name?: string;
    code?: number;
    color: Color;
    icon: Icon;
  };
  errorMessage: string;
  errorPosition: number;
  total: number;
  events: EventsViewModel[];
};

//TODO: Improve types for commands events and errors
export type ContractsViewModel = {
  commands: any[];
  events: any[];
  errors: any[];
};
