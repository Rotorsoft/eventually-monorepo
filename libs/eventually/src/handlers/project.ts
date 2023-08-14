import type { ProjectorStore } from "../interfaces";
import { _imps, app, log } from "../ports";
import type {
  CommittedEvent,
  Messages,
  Patch,
  Projection,
  ProjectionPatch,
  ProjectionResults,
  ProjectorFactory,
  State
} from "../types";
import { patchCopy } from "../utils";

/**
 * Projects events into a projection map (reduced partial states indexed by id)
 *
 * Result of reducing a stream of events into a map of patches,
 * where the cardinality of the map (keys) is driven by the input stream.
 *
 * - Use a batch process (starting from a subscription watermark) when the cardinality is high
 * - Use a projector store to materialize/cache
 *
 * @param factory the projector factory
 * @param events the committed events to project
 * @returns the projection map
 */
export default async function project<S extends State, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  events: CommittedEvent<E>[]
): Promise<ProjectionResults> {
  const map = new Map<string, ProjectionPatch<S>>();
  if (!events.length) return { upserted: 0, deleted: 0, watermark: -1 };

  const projector = factory();
  Object.setPrototypeOf(projector, factory as object);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    log().green().trace(`\n>>> ${factory.name}`, event);
    const patches = await projector.on[event.name](event, map);
    patches.forEach((patch) => {
      if (Object.keys(patch).length === 1) {
        // just the id, mark for deletion
        map.set(patch.id, { id: patch.id } as Patch<Projection<S>> & {
          id: string;
        });
      } else {
        // patch over the existing map
        const rec =
          map.get(patch.id) ||
          ({
            id: patch.id
          } as ProjectionPatch<S>);
        map.set(
          patch.id,
          patchCopy(rec, patch as Patch<Patch<Projection<S>> & { id: string }>)
        );
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
