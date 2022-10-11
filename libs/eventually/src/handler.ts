import { app, log, store } from ".";
import {
  CommittedEventMetadata,
  Message,
  MessageHandler,
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
export const load = async <M extends Payload, E>(
  reducible: Reducible<M, E>,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<M>) => void
): Promise<Snapshot<M> & { applyCount: number }> => {
  const snapshot = useSnapshots && (await app().readSnapshot(reducible));
  let state = snapshot?.state || reducible.init();
  let event = snapshot?.event;
  let applyCount = 0;

  await store().query(
    (e) => {
      event = e;
      const apply = (reducible as any)["apply".concat(e.name)];
      state = apply && apply(state, e);
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
export const handleMessage = async <M extends Payload, C, E>(
  handler: MessageHandler<M, C, E>,
  callback: (state: M) => Promise<Message<string, Payload>[]>,
  metadata: CommittedEventMetadata,
  notify = true
): Promise<Snapshot<M>[]> => {
  const streamable = getStreamable(handler);
  const reducible = getReducible(handler);
  const snapshot = reducible
    ? await load(reducible)
    : { event: undefined, applyCount: 0 };

  const events = await callback(snapshot.state);
  events.map((event) => validateMessage(event));
  if (!(events.length && streamable)) return [];

  const committed = await store().commit(
    streamable.stream(),
    events,
    metadata,
    metadata.causation.command?.expectedVersion,
    notify
  );
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
    return { event, state } as Snapshot<M>;
  });

  // TODO: implement reliable async snapshotting - persist queue? start on app load?
  void app().writeSnapshot(reducible, snapshots.at(-1), snapshot.applyCount);

  return snapshots;
};
