import { CommittedEvent, Payload } from "@rotorsoft/eventually";

/**
 * Services
 * - `id` The service unique id
 * - `channel` The service channel - (example: pg://all = postgres "all" stream)
 * - `url` The service url - (example: http://localhost:3000)
 */
export type Service = {
  id: string;
  channel: string;
  url: string;
};

/**
 * Subscriptions connect producer and consumer services using pattern matching rules
 * - `id` The subscription unique id
 * - `producer` The producer service
 * - `consumer` The consumer service
 * - `path` The path on the consumer service (appended to url - policy name by convention)
 * - `streams`: regex rules to filter by substreams (aggregates, systems, process managers)
 * - `names`: regex rules to filter by event names
 * - `position` The position in the stream - last acked id
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
};

/**
 * Worker configuration
 */
export type WorkerConfig = {
  id: string;
  channel: string;
  endpoint: string;
  streams: string;
  names: string;
  position: number;
  producer: string;
  consumer: string;
};

export type Operation = "RESTART" | "INSERT" | "UPDATE" | "DELETE" | "RETRY";
/**
 * Trigger payload
 * - `id`: trigger id (record id, event name)
 * - `operation`: triggering operation
 * - `position`: optional position in stream
 * - `retries`: optional retry counter
 */
export type TriggerPayload = {
  id: string;
  operation: Operation;
  position?: number;
  retries?: number;
};

/**
 * Subscription trigger callback to signal integration
 */
export type TriggerCallback = (trigger: TriggerPayload) => Promise<void>;

/**
 * Stream listeners listen for stream notifications and trigger integrations
 */
export type StreamListener = {
  listen: (
    id: string,
    channel: URL,
    callback: TriggerCallback
  ) => Promise<void>;
  close: () => Promise<void>;
};
export type StreamListenerFactory = () => StreamListener;

export type EventStats = { count: number; min: number; max: number };
/**
 * Records worker stats
 * - `id`: subscription id
 * - `trigger`: trigger payload
 * - `position`: last position in stream
 * - `batches`: number of pulled batches
 * - `total`: number of pulled events
 * - `events`: hash of event stats by event name
 *    - `key`: response code
 *    - `value`: response stats (count, min-id, max-id)
 */
export type WorkerStats = {
  id: string;
  trigger: TriggerPayload;
  batches: number;
  total: number;
  events: Record<string, Record<number, EventStats>>;
};

/**
 * Worker view state
 */
export type WorkerViewState = {
  id: string;
  active: boolean;
  exitStatus: string;
  error: string;
  color: string;
  icon: string;
  position: number;
  channelPosition: number;
  total: number;
  events: Array<{
    name: string;
    ok: EventStats;
    ignored: EventStats;
    errors: EventStats;
  }>;
};

/**
 * Pull channels pull events from streams
 */
export type PullChannel = {
  listen: (callback: TriggerCallback) => Promise<void>;
  pull: (
    position: number,
    limit: number
  ) => Promise<CommittedEvent<string, Payload>[]>;
};

/**
 * Push channels push events to consumer endpoints
 */
export type PushResponse = {
  status: number;
  statusText: string;
};
export type PushChannel = {
  init: (...args: any) => void;
  push: (event: CommittedEvent<string, Payload>) => Promise<PushResponse>;
};

/**
 * Maps protocols to channel factories
 */
export type ChannelResolvers = {
  pull: Record<string, (id: string, channel: URL) => PullChannel>;
  push: Record<string, (id: string, endpoint: URL) => PushChannel>;
};