import { app, log, store } from ".";
import { validateMessage } from "./schema";
import { MessageHandlingArtifact, Reducible } from "./types/artifacts";
import {
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Messages,
  Snapshot,
  State
} from "./types/messages";

/**
 * Loads current model state
 * @param reducible the reducible
 * @param useSnapshots flag to use snapshot store
 * @param callback optional reduction predicate
 * @returns current model state
 */
export const load = async <S extends State, E extends Messages>(
  reducible: Reducible<S, E>,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E> & { applyCount: number }> => {
  const snapOps =
    (useSnapshots && app().snapOpts[Object.getPrototypeOf(reducible).name]) ||
    undefined;
  const snapshot =
    (snapOps && (await snapOps.store.read<S, E>(reducible.stream()))) ||
    undefined;
  let state = snapshot?.state || reducible.init();
  let event = snapshot?.event;
  let applyCount = 0;

  await store().query(
    (e) => {
      event = e as CommittedEvent<E>;
      state = reducible.reduce[event.name](state, event);
      applyCount++;
      callback && callback({ event, state });
    },
    { stream: reducible.stream(), after: event?.id }
  );

  log().trace(
    "gray",
    `   ... ${reducible.stream()} loaded ${applyCount} event(s)`
  );

  return { event, state, applyCount };
};

/**
 * Generic message handler
 * @param artifact Message handler
 * @param callback Concrete message handling callback
 * @param metadata Message metadata
 * @param notify Notify commits
 * @returns Reduced snapshots
 */
export const handleMessage = async <
  S extends State,
  C extends Messages,
  E extends Messages
>(
  artifact: MessageHandlingArtifact<S, C, E>,
  callback: (state: S) => Promise<Message<E>[]>,
  metadata: CommittedEventMetadata,
  notify = true
): Promise<Snapshot<S, E>[]> => {
  const streamable = "stream" in artifact ? artifact : undefined;
  const reducible = "reduce" in artifact ? artifact : undefined;

  const snapshot = reducible
    ? await load<S, E>(reducible)
    : { state: {} as S, applyCount: 0 };

  const events = await callback(snapshot.state);
  if (streamable && events.length) {
    const committed = await store().commit(
      streamable.stream(),
      events.map(validateMessage),
      metadata,
      metadata.causation.command?.expectedVersion,
      notify
    );

    if (reducible) {
      let state = snapshot.state;
      const snapshots = committed.map((event) => {
        log().trace(
          "gray",
          `   ... ${reducible.stream()} committed ${event.name} @ ${
            event.version
          }`,
          event.data
        );
        state = reducible.reduce[event.name](state, event as CommittedEvent<E>);
        log().trace(
          "gray",
          `   === ${JSON.stringify(state)}`,
          ` @ ${event.version}`
        );
        return { event, state } as Snapshot<S, E>;
      });
      const snapOps = app().snapOpts[Object.getPrototypeOf(reducible).name];
      if (
        snapOps &&
        snapshot.applyCount > snapOps.threshold &&
        snapshots.length
      ) {
        try {
          // TODO: implement reliable async snapshotting from persisted queue started by app
          await snapOps.store.upsert(
            reducible.stream(),
            snapshots.at(-1) as Snapshot
          );
        } catch {
          // fail quietly for now
          // TODO: monitor failures to recover
        }
      }
      return snapshots;
    } else
      return committed.map(
        (event) => ({ state: snapshot.state, event } as Snapshot<S, E>)
      );
  } else return [];
};
