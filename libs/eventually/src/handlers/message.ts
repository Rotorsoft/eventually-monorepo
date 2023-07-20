import { STATE_EVENT } from "../interfaces";
import { app, log, store } from "../ports";
import type {
  Artifact,
  ArtifactFactory,
  CommittedEventMetadata,
  Message,
  Messages,
  Reducible,
  ReducibleFactory,
  Snapshot,
  State,
  Streamable
} from "../types";
import { clone, validateMessage } from "../utils";
import { loadReducible } from "./load";

/**
 * Generic message handler
 * @param factory the artifact factory
 * @param artifact the message handling artifact
 * @param filter the event filter (stream or actor)
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
  filter: string,
  callback: (snapshot: Snapshot<S>) => Promise<Message<E>[]>,
  metadata: CommittedEventMetadata
): Promise<Snapshot<S, E>[]> {
  const stream = "stream" in artifact ? artifact.stream : undefined;
  const reduce = "reduce" in artifact ? artifact.reduce : undefined;
  const reducer = ("reducer" in artifact && artifact.reducer) || clone;

  const snapshot = reduce
    ? await loadReducible(
        factory as ReducibleFactory<S, C, E>,
        artifact as Reducible<S, E> & Streamable,
        filter
      )
    : ({ state: {} as S, applyCount: 0, stateCount: 0 } as Snapshot<S, E>);

  const events = await callback(snapshot);
  if (stream && events.length) {
    const committed = await store().commit(
      stream,
      events.map((e) => (e.name === STATE_EVENT ? e : validateMessage(e))),
      metadata,
      metadata.causation.command?.expectedVersion || snapshot.event?.version
    );
    if (reduce) {
      let { state, applyCount } = snapshot;
      const snapshots = committed.map((event) => {
        log()
          .gray()
          .trace(
            `   ... ${stream} committed ${event.name} @ ${event.version}`,
            event.data
          );
        state = reducer(state, reduce[event.name](state, event));
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
      app().emit("commit", { factory, snapshot: snapshots.at(-1) });
      return snapshots;
    } else {
      app().emit("commit", { factory });
      return committed.map(
        (event) => ({ state: snapshot.state, event }) as Snapshot<S, E>
      );
    }
  } else return [];
}
