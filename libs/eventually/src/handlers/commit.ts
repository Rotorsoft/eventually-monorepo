import { STATE_EVENT } from "../interfaces";
import { log, store } from "../ports";
import type {
  Artifact,
  CommittedEventMetadata,
  Message,
  Messages,
  Snapshot,
  State,
  Streamable
} from "../types";
import { clone, validateMessage } from "../utils";

/**
 * Commits events to artifact's stream
 * @param artifact the streamable/reducible artifact
 * @param events the new events to commit
 * @param snapshot last reducible snapshot (when reducible artifact)
 * @param metadata commit metadata
 * @returns reduced event snapshots (when reducible artifact)
 */
export async function commit<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  artifact: Artifact<S, C, E> & Streamable,
  events: Message<E>[],
  snapshot: Snapshot<S, E>,
  metadata: CommittedEventMetadata
): Promise<Snapshot<S, E>[]> {
  const committed = await store().commit(
    artifact.stream,
    events.map((e) => (e.name === STATE_EVENT ? e : validateMessage(e))),
    metadata,
    metadata.causation.command?.expectedVersion || snapshot.event?.version
  );

  if ("reduce" in artifact) {
    const reducer = ("reducer" in artifact && artifact.reducer) || clone;
    let { state, applyCount } = snapshot;
    const snapshots = committed.map((event) => {
      log()
        .gray()
        .trace(
          `   ... ${artifact.stream} committed ${event.name} @ ${event.version}`,
          event.data
        );
      state = reducer(state, artifact.reduce[event.name](state, event));
      applyCount++;
      log()
        .gray()
        .trace(`   === ${JSON.stringify(state)}`, ` @ ${event.version}`);
      return {
        event,
        state,
        applyCount,
        stateCount: snapshot.stateCount
      } as Snapshot<S, E>;
    });
    return snapshots;
  }

  return committed.map(
    (event) => ({ state: snapshot.state, event }) as Snapshot<S, E>
  );
}
