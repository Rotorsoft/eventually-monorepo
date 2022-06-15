import { RequestHandler, Router } from "express";

/**
 * Services
 * - `id` The service unique id
 * - `channel` The service channel - (example: pg://all = postgres "all" stream)
 * - `url` The service url - (example: http://localhost:3000)
 * - `position` The position in the channel - last trigger id
 * - `updated` The last update timestamp
 */
export type Service = {
  id: string;
  channel: string;
  url: string;
  position: number;
  updated: Date;
};

/**
 * Subscriptions connect producer and consumer services using pattern matching rules
 * - `id` The subscription unique id
 * - `producer` The producer service
 * - `consumer` The consumer service
 * - `path` The path on the consumer service (appended to url - policy name by convention)
 * - `streams`: regex rules to filter by substringeams (aggregates, systems, process managers)
 * - `names`: regex rules to filter by event names
 * - `position` The position in the stream - last acked id
 * - `updated` The last update timestamp
 * - `batch_size` The pull batch size (default 100)
 * - `retries` The number of retries before pausing (default 3)
 * - `retry_timeout_sec` Seconds between retries with exponential backoff (default 10)
 */
export type Subscription = {
  id: string;
  active: boolean;
  producer: string;
  consumer: string;
  path: string;
  streams: string;
  names: string;
  position: number;
  updated: Date;
  batch_size: number;
  retries: number;
  retry_timeout_secs: number;
};

export type Operation = "RESTART" | "INSERT" | "UPDATE" | "DELETE" | "RETRY";
/**
 * Trigger payload
 * - `id`: trigger id (record id, event name)
 * - `operation`: triggering operation
 * - `position`: optional position in stream
 * - `payload`: optional trigger payload
 * - `retry_count`: optional retry counter
 */
export type TriggerPayload = {
  id: string;
  operation: Operation;
  position?: number;
  payload?: any;
  retry_count?: number;
};

/**
 * Subscription trigger callback to signal integration
 */
export type TriggerCallback = (trigger: TriggerPayload) => Promise<void>;

/**
 * Push response
 */
export type PushResponse = {
  status: number;
  statusText: string;
};

/**
 * App options
 */
export type AppOptions = {
  port?: number;
  middleware?: RequestHandler[];
  prerouters?: Array<{ path: string; router: Router }>;
  serviceLogLinkTemplate?: string;
};
