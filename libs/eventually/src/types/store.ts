import { CommittedEvent, Messages } from "./messages";

/**
 * Basic event store statistics
 * TODO: implement as projection of all events (by artifact)
 */
export type StoreStat = {
  name: string;
  count: number;
  firstId?: number;
  lastId?: number;
  firstCreated?: Date;
  lastCreated?: Date;
};

/**
 * Consumer subscription
 */
export type Subscription = {
  readonly consumer: string;
  readonly watermark: number;
  readonly lease?: string;
  readonly expires?: Date;
};

/**
 * Consumer lease
 */
export type Lease<E extends Messages> = Subscription & {
  readonly lease: string;
  readonly expires: Date;
  readonly events: CommittedEvent<E>[];
};

/**
 * Poll options
 * - `names` the event names to poll
 * - `timeout` the lease timeout in ms
 * - `limit` the max number of events to poll
 */
export type PollOptions = {
  readonly names: string[];
  readonly timeout: number;
  readonly limit: number;
};
