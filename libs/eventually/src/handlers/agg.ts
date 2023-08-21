import type { ProjectorStore } from "../interfaces";
import { _imps, app } from "../ports";
import type {
  AggQuery,
  AggResult,
  Messages,
  ProjectorFactory,
  State
} from "../types";

/**
 * Aggregates projection records
 * @param factory the projector factory
 * @param query the aggregate query
 * @returns the aggregate results
 */
export default async function agg<S extends State, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  query: AggQuery<S>
): Promise<AggResult<S>> {
  const store = (app().artifacts.get(factory.name)?.projector?.store ||
    _imps()) as ProjectorStore<S>;
  return await store.agg(query);
}
