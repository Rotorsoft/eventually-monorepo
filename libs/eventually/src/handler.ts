import { app, log, store } from ".";
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
import { getReducible, getStreamable, validateMessage } from "./utils";

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
  const snapshot = useSnapshots && (await app().readSnapshot(reducible));
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
    : { event: undefined, applyCount: 0 };

  const events = await callback(snapshot.state);
  events.map((event) => validateMessage(event));
  if (!(events.length && streamable)) return [];

  const committed = (await store().commit(
    streamable.stream(),
    events as Message[],
    metadata,
    metadata.causation.command?.expectedVersion,
    notify
  )) as CommittedEvent<E>[];
  if (!reducible)
    return committed.map((event) => ({
      event
    }));

  let state = snapshot.state;
  const snapshots = committed.map((event) => {
    log().trace(
      "gray",
      `   ... ${streamable.stream()} committed ${event.name} @ ${
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
    return { event, state } as Snapshot<M, E>;
  });

  // TODO: implement reliable async snapshotting - persist queue? start on app load?
  void app().writeSnapshot(reducible, snapshots.at(-1), snapshot.applyCount);

  return snapshots;
};
