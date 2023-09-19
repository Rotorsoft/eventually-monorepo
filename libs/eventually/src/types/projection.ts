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
 * A partial state applied to a record id or a filter
 */
export type ProjectionPatch<S extends State> = Readonly<
  Patch<S> & ({ id: string } | { where: ProjectionWhere<S> })
>;

/**
 * A map of projection patches
 * - `records` patched records by id (inserts, updates, or deletes)
 * - `updates` patched updates by filter
 * - `deletes` patched deletes by filter
 */
export type ProjectionMap<S extends State> = {
  records: Map<string, Patch<S>>;
  updates: ProjectionPatch<S>[];
  deletes: ProjectionWhere<S>[];
};

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
export type Condition<T> = { readonly [K in Operator]?: T } | Readonly<T>;

/**
 * Projection filter expression by fields in record
 */
export type ProjectionWhere<S extends State = State> = {
  readonly [K in keyof Projection<S>]?: Condition<S[K] | Array<S[K]>>;
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

/**
 * REST projection query options
 */
export type RestProjectionQuery = {
  ids?: string[];
  select?: string[];
  where?: string[];
  sort?: string[];
  limit?: number;
};

/**
 * Supported aggregate functions
 */
export type Agg = "count" | "sum" | "avg" | "min" | "max";

// TODO: add constrain to select only numeric fields in aggs
// type NumberKeys<T> = {
//   [K in keyof T]: T[K] extends number | undefined ? K : never;
// }[keyof T];

/**
 * Aggregate query options
 * - `select` aggregated fields
 * - `where?` filtered fields in projection record (should be indexed)
 */
export type AggQuery<S extends State> = {
  readonly select: { readonly [K in keyof S]?: Agg[] };
  readonly where?: ProjectionWhere<S>;
};

/**
 * REST aggregate query options
 */
export type RestAggQuery = {
  select?: string[];
  where?: string[];
};

/**
 * Aggregate results
 */
export type AggResult<S extends State> = {
  readonly [K in keyof S]?: Partial<Record<Agg, number | null>>;
};
