import type { ProjectorStore } from "../interfaces";
import { _imps, app, log } from "../ports";
import type {
  CommittedEvent,
  Messages,
  Patch,
  ProjectionMap,
  ProjectionResults,
  ProjectorFactory,
  State
} from "../types";
import { patch } from "../utils/patch";

/**
 * Projects events (materialized view).
 * - Projectors reduce events by returning state patches. A patch with an empty record `{id}` represents a `delete` operation.
 * - Handles event batches (starting from the subscription watermark), reducing patches in a projection map before the final commit.
 * - The cardinality of the projection is driven by the input stream (can map one or many aggregates in one record).
 * - The map can contain record-level patches (by id) and filtered patches (updates and deletes).
 * - Commits are executed in the following order:
 *    - Filtered deletes
 *    - Filtered updates
 *    - Record level patches
 *
 * @param factory the projector factory
 * @param events the committed events to project
 * @returns projection results
 */
export default async function project<S extends State, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  events: CommittedEvent<E>[]
): Promise<ProjectionResults> {
  const map: ProjectionMap<S> = {
    records: new Map<string, Patch<S>>(),
    updates: [],
    deletes: []
  };
  if (!events.length) return { upserted: 0, deleted: 0, watermark: -1 };

  const projector = factory();
  Object.setPrototypeOf(projector, factory as object);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    log().green().trace(`\n>>> ${factory.name}`, event);
    const patches = await projector.on[event.name](event, map);
    patches.forEach((p) => {
      const id = "id" in p && p.id;
      const where = "where" in p && p.where;
      if (Object.keys(p).length === 1) {
        // just id or where
        // mark for deletion!
        if (id) map.records.set(id, {} as Patch<S>);
        else if (where) map.deletes.push(where);
      } else {
        if (id) {
          const { id, ..._patch } = p;
          // reduce record patches
          const rec = map.records.get(id) || ({} as Patch<S>);
          // TODO: this is another good place to handle default values
          map.records.set(id, patch<S>(rec, _patch as Patch<S>) as Patch<S>);
        } else if (where) map.updates.push(p);
      }
    });
  }

  const store = (app().artifacts.get(factory.name)?.projector?.store ||
    _imps()) as ProjectorStore<S>;
  const results = await store.commit(map, events.at(-1)!.id);
  log()
    .gray()
    .trace("   ... committed", JSON.stringify(map), JSON.stringify(results));
  app().emit("projection", { factory, results });

  return results;
}
