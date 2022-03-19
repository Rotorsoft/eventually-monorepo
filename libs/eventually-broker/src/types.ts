import { CommittedEvent, Payload } from "@rotorsoft/eventually";

/**
 * Subscriptions connect enpoints to streaming channels using pattern matching rules
 * - `id` The subscription unique id
 * - `channel` The source channel url - (example: pg://all = postgres "all" stream)
 * - `endpoint` The endpoint url - (example: http://localhost:3000 = http post endpoint)
 * - `streams`: regex rules to filter by substreams (aggregates, systems, process managers)
 * - `names`: regex rules to filter by event names
 * - `position` The position in the stream - last acked id
 */
export type Subscription = {
  id: string;
  active: boolean;
  channel: string;
  streams: string;
  names: string;
  endpoint: string;
  position: number;
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

/**
 * Records integration stats
 * - `id`: subscription id
 * - `trigger`: trigger payload
 * - `position`: last position in stream
 * - `batches`: number of pulled batches
 * - `total`: number of pulled events
 * - `events`: hash of event stats by event name
 *    - `key`: response code
 *    - `value`: response count
 */
export type SubscriptionStats = {
  id: string;
  trigger: TriggerPayload;
  position: number;
  batches: number;
  total: number;
  events: Record<string, Record<number, number>>;
};

/**
 * Subscription view properties
 */
export type Props = {
  id: string;
  active: boolean;
  exitStatus: string;
  error: string;
  color: string;
  icon: string;
  position: number;
  maxTriggerPosition: number;
  total: number;
  events: Array<{ name: string; ok: number; ignored: number; errors: number }>;
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
 * Channel resolvers by protocol
 */
export type ChannelResolver = {
  pull: (id: string, channel: URL) => PullChannel;
  push: (id: string, endpoint: URL) => PushChannel;
};

/**
 * Maps protocols to resolvers
 * example: 
  `
  "pg:": {
    pull: (id: string, channel: URL) => PostgresPullChannel(id, channel),
    push: undefined
  }
  `
 */
export type ChannelResolvers = Record<string, ChannelResolver>;
