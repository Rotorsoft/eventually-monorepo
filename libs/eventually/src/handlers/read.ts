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
 * @returns records found
 */
export default async function read<S extends State, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  query: string | string[] | ProjectionQuery<S>
): Promise<ProjectionRecord<S>[]> {
  const store = (app().artifacts.get(factory.name)?.projector?.store ||
    _imps()) as ProjectorStore<S>;
  const ids =
    typeof query === "string"
      ? [query]
      : Array.isArray(query)
      ? query
      : undefined;
  return ids ? await store.load(ids) : store.query(query as ProjectionQuery<S>);
}
