import { app, log, store } from ".";
import { validateMessage } from "./schema";
import {
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  MessageHandler,
  Messages,
  Payload,
  Reducible,
  Snapshot
} from "./types";
import { getReducible, getStreamable } from "./utils";

/**
 * Loads current model state
 * @param reducible the reducible
 * @param useSnapshots flag to use snapshot store
 * @param callback optional reduction predicate
 * @returns current model state
 */
export const load = async <M extends Payload, E extends Messages>(
  reducible: Reducible<M, E>,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<M, E>) => void
): Promise<Snapshot<M, E> & { applyCount: number }> => {
  const snapshot =
    (useSnapshots && (await app().readSnapshot(reducible))) || undefined;
  let state = snapshot?.state || reducible.init();
  let event = snapshot?.event;
  let applyCount = 0;

  await store().query(
    (e) => {
      event = e as CommittedEvent<E>;
      const apply = (reducible as any)["apply".concat(event.name)];
      state = apply && apply(state, event);
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
 * @param handler Message handler
 * @param callback Concrete message handling callback
 * @param metadata Message metadata
 * @param notify Notify commits
 * @returns Reduced snapshots
 */
export const handleMessage = async <
  M extends Payload,
  C extends Messages,
  E extends Messages
>(
  handler: MessageHandler<M, C, E>,
  callback: (state: M) => Promise<Message<E>[]>,
  metadata: CommittedEventMetadata,
  notify = true
): Promise<Snapshot<M, E>[]> => {
  const streamable = getStreamable(handler);
  const reducible = getReducible(handler);

  const snapshot = reducible
    ? await load(reducible)
    : { state: {} as M, applyCount: 0 };

  const events = await callback(snapshot.state);
  if (streamable && events.length) {
    const committed = (await store().commit(
      streamable.stream(),
      events.map(validateMessage),
      metadata,
      metadata.causation.command?.expectedVersion,
      notify
    )) as CommittedEvent<E>[];

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
        state = (reducible as any)["apply".concat(event.name)](state, event);
        log().trace(
          "gray",
          `   === ${JSON.stringify(state)}`,
          ` @ ${event.version}`
        );
        return { event, state };
      });
      // TODO: implement reliable async snapshotting - persist queue? start on app load?
      const snap = snapshots.at(-1);
      snap && void app().writeSnapshot(reducible, snap, snapshot.applyCount);
      return snapshots;
    } else return committed.map((event) => ({ state: snapshot.state, event }));
  } else return [];
};
