import { Operator } from "./enums";
import type { Patch, State } from "./messages";

/**
 * EXPERIMENTAL FEATURE - This is a work in progress and subject to change!
 *
 * Looking for a simple interface to store and query projections
 */

/**
 * A state with a required unique id
 */
export type Projection<S extends State> = S & { id: string };

/**
 * A partial state with a required unique id
 */
export type ProjectionPatch<S extends State> = Readonly<
  Patch<Projection<S>> & { id: string }
>;

/**
 * A map of projection patches
 */
export type ProjectionMap<S extends State> = Map<string, ProjectionPatch<S>>;

/**
 * *** STORE SECTION ***
 */

/**
 * Projection Record
 *
 * Stored/cached/materialized `state` after projecting/reducing events
 * from the stream following specific `Projector` logic
 *
 * - `state` the stored state with a unique identifier `id`
 * - `watermark` the last projected event id
 */
export type ProjectionRecord<S extends State = State> = {
  readonly state: Projection<S>;
  readonly watermark: number;
};

/**
 * Projection Results
 *
 * The results after a `Projection Store` tries to commit the projection records in a `Projection`
 *
 * - `upserted` upserted records
 * - `deleted` deleted records
 * - `watermark` the new watermark stored in upserted records
 * - `error?` error message if commit fails
 */
export type ProjectionResults = {
  readonly upserted: number;
  readonly deleted: number;
  readonly watermark: number;
  readonly error?: string;
};

/**
 * *** QUERY SECTION ***
 */

/**
 * Filter condition. Uses scalar value as a shortcut to eq operator
 */
export type Condition<T> =
  | {
      readonly operator: Operator;
      readonly value: T;
    }
  | T;

/**
 * Projection filter expression by fields in record
 */
export type ProjectionWhere<S extends State = State> = {
  readonly [K in keyof Projection<S>]?: Condition<S[K]>;
};

/**
 * Projection sort expression by fields in record
 */
export type ProjectionSort<S extends State = State> = {
  readonly [K in keyof Projection<S>]?: "asc" | "desc";
};

/**
 * Projection query options
 * - `select?` selected fields in projection record
 * - `where?` filtered fields in projection record (should be indexed)
 * - `sort?` sorted fields (should be indexed) (combined with limit)
 * - `limit?` max number of records
 */
export type ProjectionQuery<S extends State = State> = {
  readonly select?: Array<keyof Partial<Projection<S>>>;
  readonly where?: ProjectionWhere<S>;
  readonly sort?: ProjectionSort<S>;
  readonly limit?: number;
};
