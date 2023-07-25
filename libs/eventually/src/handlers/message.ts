import { app } from "../ports";
import type {
  Artifact,
  ArtifactFactory,
  CommittedEventMetadata,
  Message,
  Messages,
  Reducible,
  Snapshot,
  State,
  Streamable
} from "../types";
import { commit } from "./commit";
import { reduce } from "./load";

/**
 * Generic message handler
 * @param factory the artifact factory
 * @param artifact the message handling artifact
 * @param id the reducible id (aggregate:stream or processmanager:actor)
 * @param callback the message handling callback
 * @param metadata the message metadata
 * @returns reduced snapshots of new events when artifact is reducible
 */
export default async function message<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: ArtifactFactory<S, C, E>,
  artifact: Artifact<S, C, E>,
  id: { stream?: string; actor?: string },
  callback: (snapshot: Snapshot<S>) => Promise<Message<E>[]>,
  metadata: CommittedEventMetadata
): Promise<Snapshot<S, E>[]> {
  const snapshot =
    "reduce" in artifact
      ? await reduce(artifact as Reducible<S, E> & Streamable, id)
      : ({ state: {} as S, applyCount: 0, stateCount: 0 } as Snapshot<S, E>);

  const events = await callback(snapshot);

  if (events.length && "stream" in artifact) {
    const snapshots = await commit(artifact, events, snapshot, metadata);
    app().emit("commit", { factory, snapshot: snapshots.at(-1) });
    return snapshots;
  }
  return [];
}
