import { ProjectionStore } from "../interfaces/stores";
import { Payload } from "./message";

/**
 * Projections are models with watermarks
 */
export type Projection<M extends Payload> = {
  state?: Readonly<M>;
  watermarks: Readonly<Record<string, number>>;
};

/**
 * Artifacts that project events to a projection
 */
export type Projectable<M extends Payload, E> = {
  store: () => ProjectionStore;
} & {
  [Name in keyof E as `on${Capitalize<Name & string>}`]: (
    data?: E[Name] & Payload,
    state?: M
  ) => M;
};

/**
 * Projectors apply events to produce projections
 */
export type Projector<M extends Payload, E> = Projectable<M, E>;
export type ProjectorFactory<M extends Payload, E> = () => Projector<M, E>;

/**
 * Options to query the all stream
 * - stream? filter by stream
 * - names? filter by event names
 * - before? filter events before this id
 * - after? filter events after this id
 * - limit? limit the number of events to return
 * - created_before? filter events created before this date/time
 * - created_after? filter events created after this date/time
 * - backward? order descending when true
 * - correlation? filter by correlation
 */
export type AllQuery = {
  readonly stream?: string;
  readonly names?: string[];
  readonly before?: number;
  readonly after?: number;
  readonly limit?: number;
  readonly created_before?: Date;
  readonly created_after?: Date;
  readonly backward?: boolean;
  readonly correlation?: string;
};
