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
 * - `names` event names to poll
 * - `timeout` lease timeout in ms
 * - `limit` max number of events to poll
 * - `times` number of times to poll
 */
export type PollOptions = {
  readonly names: string[];
  readonly timeout: number;
  readonly limit: number;
  readonly times?: number;
};
