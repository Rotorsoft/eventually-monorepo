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
};

export type Operation = "RESTART" | "INSERT" | "UPDATE" | "DELETE" | "RETRY";
/**
 * Trigger payload
 * - `id`: trigger id (record id, event name)
 * - `operation`: triggering operation
 * - `position`: optional position in stream
 * - `payload`: optional trigger payload
 * - `retries`: optional retry counter
 */
export type TriggerPayload = {
  id: string;
  operation: Operation;
  position?: number;
  payload?: any;
  retries?: number;
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
