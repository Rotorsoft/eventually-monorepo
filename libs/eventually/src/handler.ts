import { app, log, store } from ".";
import {
  CommittedEventMetadata,
  Message,
  MessageHandler,
  Payload,
  Snapshot
} from "./types";
import { getReducible, getStreamable, validateMessage } from "./utils";

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
    ? await app().load(reducible)
    : { event: undefined, count: 0 };

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
  if (!reducible) return committed.map((event) => ({ event }));

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
    return { event, state };
  });

  if (reducible.snapshot && snapshot.count > reducible.snapshot?.threshold) {
    const snapstore = app().getSnapshotStore(reducible);
    await snapstore.upsert(reducible.stream(), snapshots[snapshots.length - 1]);
  }

  return snapshots;
};
