import type { ProjectorStore } from "../interfaces";
import { _imps, app } from "../ports";
import type {
  Messages,
  ProjectionQuery,
  ProjectionRecord,
  ProjectorFactory,
  State
} from "../types";

/**
 * Reads projection
 * @param factory the projector factory
 * @param query the query allowing projection id, ids, or full projection query
 * @param callback the callback receiving projection records
 * @returns number of records found
 */
export default async function read<S extends State, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  query: string | string[] | ProjectionQuery<S>,
  callback: (record: ProjectionRecord<S>) => void
): Promise<number> {
  const ps = (app().stores.get(factory.name) as ProjectorStore<S>) || _imps();
  const ids =
    typeof query === "string"
      ? [query]
      : Array.isArray(query)
      ? query
      : undefined;
  if (ids) {
    const records = await ps.load(ids);
    records.forEach((record) => callback(record));
    return records.length;
  }
  return ps.query(query as ProjectionQuery<S>, callback);
}
