import { Writable } from "stream";
import { Operation, Service } from "../types";

export type SubscriptionConfig = {
  id: string;
  active: boolean;
  endpoint: string;
  streams: string;
  names: string;
  position: number;
};

export type ChannelConfig = {
  id: string;
  channel: string;
  position?: number;
  subscriptions: SubscriptionConfig[];
  runs: number;
};

export type EventStats = { count: number; min: number; max: number };

export type SubscriptionStats = {
  batches: number;
  total: number;
  events: Record<string, Record<number, EventStats>>;
};

export type SubscriptionState = {
  workerId?: number;
  active: boolean;
  position: number;
  channelStatus: string;
  endpointStatus: {
    code: number;
    color: string;
  };
  errorMessage: string;
  stats: SubscriptionStats;
};

export type ErrorMessage = {
  message: string;
  config?: SubscriptionConfig;
  code?: number;
  color?: string;
  stats?: SubscriptionStats;
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
    code: number;
    color: string;
    icon: string;
  };
  errorMessage: string;
  total: number;
  events: EventsViewModel[];
};

export type State = {
  init: (services: Service[]) => Promise<void>;
  refreshService: (operation: Operation, id: string) => Promise<void>;
  refreshSubscription: (operation: Operation, id: string) => Promise<void>;
  subscribeSSE: (session: string, stream: Writable, id?: string) => void;
  unsubscribeSSE: (session: string) => void;
  services: () => Service[];
  viewModel: (id: string) => SubscriptionViewModel;
};

// 404 - Not Found
// 429 - Too Many Requests
// 503 - Service Unavailable
// 504 - Gateway Timeout
export const RetryableHttpStatus = [404, 429, 503, 504];

// 200 - Ok
// 204 - No Content (Ignored by RegEx filters)
export const CommittableHttpStatus = [200, 204];