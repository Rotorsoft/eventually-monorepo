import { CommittedEvent, Payload } from "@andela-technology/eventually";
import { RequestHandler } from "express";
import { PathItemObject, SchemaObject } from "openapi3-ts";
import { Breaker } from "./breaker";
import { ChannelResolvers, SubscriptionStore } from "./interfaces";

export type ExtendedSchemaObject = SchemaObject & {
  name: string;
  refs?: string[];
  inSnapshot?: boolean;
};

export type ExtendedPathItemObject = PathItemObject & {
  path: string;
  refs?: string[];
};

export type ServiceSpec = {
  breaker?: Breaker;
  discovered?: Date;
  version?: string;
  eventHandlers?: Record<string, ExtendedPathItemObject>;
  commandHandlers?: Record<string, ExtendedPathItemObject>;
  schemas?: Record<string, ExtendedSchemaObject>;
  allPath?: string;
};

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
  status?: string;
  label?: string;
} & ServiceSpec;

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
 * - `endpoint` Calculated field combining consumer url with path
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
  endpoint: string;
};

export type Operation =
  | "REFRESH"
  | "RESTART"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "RETRY"
  | "MANUAL";

/**
 * Trigger payload
 * - `id`: trigger id (record id, event name)
 * - `operation`: triggering operation
 * - `position`: optional position in stream
 * - `payload`: optional trigger payload
 */
export type TriggerPayload = {
  id: string;
  operation: Operation;
  position?: number;
  payload?: any;
};

/**
 * Pull options
 * - `operation`: triggering operation
 * - `position`: subscription position
 * - `limit`: pull limit - # of events in batch
 */
export type PullOptions = {
  operation: Operation;
  position: number;
  limit: number;
};

/**
 * Subscription trigger callback to signal integration
 */
export type TriggerCallback = (trigger: TriggerPayload) => void;

/**
 * Push response
 */
export type PushResponse = {
  statusCode: number;
  statusText?: string;
  details?: string;
};

/**
 * Push event
 */
export type PushEvent = CommittedEvent & {
  response?: PushResponse;
};

/**
 * App options
 */
export type SecretOptions = {
  byService?: Record<string, Payload>;
  bySubscription?: Record<string, Payload>;
};
export type AppOptions = {
  subscriptionStoreFactory: () => SubscriptionStore;
  resolvers?: ChannelResolvers;
  port?: number;
  middleware?: RequestHandler[];
  handlers?: RequestHandler[];
  serviceLogLinkTemplate?: string;
  secrets?: SecretOptions;
};

//=====================================================================================
// CONTRACTS QUERY LEVEL
//=====================================================================================
/**
 * Options to query the all services contracts
 * - services? filter by services
 * - names? filter by event names
 */
export type AllQuery = {
  readonly services?: string[];
  readonly names?: string[];
};
