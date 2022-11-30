import { app, log, store } from ".";
import {
  AllQuery,
  Command,
  CommandAdapterFactory,
  CommandHandlerFactory,
  CommittedEvent,
  CommittedEventMetadata,
  EventHandlerFactory,
  Message,
  MessageHandlingArtifact,
  Messages,
  Reducible,
  ReducibleFactory,
  RegistrationError,
  Snapshot,
  State
} from "./types";
import { bind, randomId, validate, validateMessage } from "./utils";

/**
 * Loads reducible artifact from store
 * @param reducible the reducible artifact
 * @param useSnapshots flag to use stored snapshots
 * @param callback optional reduction predicate
 * @returns current model snapshot
 */
const _load = async <S extends State, E extends Messages>(
  reducible: Reducible<S, E>,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> => {
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
      state = reducible.reduce[event.name](state as Readonly<S>, event);
      applyCount++;
      callback && callback({ event, state, applyCount });
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
 * @param artifact the message handling artifact
 * @param callback the message handling callback
 * @param metadata the message metadata
 * @param notify flag to notify commits
 * @returns reduced snapshots of new events when artifact is reducible
 */
const _handleMsg = async <
  S extends State,
  C extends Messages,
  E extends Messages
>(
  artifact: MessageHandlingArtifact<S, C, E>,
  callback: (state: S) => Promise<Message<E>[]>,
  metadata: CommittedEventMetadata,
  notify = true
): Promise<Snapshot<S, E>[]> => {
  const stream = "stream" in artifact ? artifact.stream() : undefined;
  const reduce = "reduce" in artifact ? artifact.reduce : undefined;

  const snapshot = reduce
    ? await _load<S, E>(artifact as Reducible<S, E>)
    : { state: {} as S, applyCount: 0 };

  const events = await callback(snapshot.state);
  if (stream && events.length) {
    const committed = await store().commit(
      stream,
      events.map(validateMessage),
      metadata,
      metadata.causation.command?.expectedVersion,
      notify
    );

    if (reduce) {
      let state = snapshot.state;
      const snapshots = committed.map((event) => {
        log().trace(
          "gray",
          `   ... ${stream} committed ${event.name} @ ${event.version}`,
          event.data
        );
        state = reduce[event.name](state, event as CommittedEvent<E>);
        log().trace(
          "gray",
          `   === ${JSON.stringify(state)}`,
          ` @ ${event.version}`
        );
        return { event, state } as Snapshot<S, E>;
      });
      const snapOps = app().snapOpts[Object.getPrototypeOf(artifact).name];
      if (snapOps && snapshot.applyCount > snapOps.threshold) {
        try {
          // TODO: implement reliable async snapshotting from persisted queue started by app
          await snapOps.store.upsert(stream, snapshots.at(-1) as Snapshot);
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

/**
 * Invokes command through adapter
 * @param factory adapter factory
 * @param payload message payload
 */
export const invoke = async <
  P extends State,
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: CommandAdapterFactory<P, C>,
  payload: P
): Promise<Snapshot<S, E>[]> => {
  const adapter = factory();
  const data = validate(payload, adapter.schemas.message);
  return command(adapter.on(data));
};

/**
 * Handles command
 * @param command command message
 * @param metadata optional metadata to track causation
 * @returns array of snapshots produced by this command
 */
export const command = async <
  S extends State,
  C extends Messages,
  E extends Messages
>(
  command: Command<C>,
  metadata?: CommittedEventMetadata
): Promise<Snapshot<S, E>[]> => {
  const { actor, name, id, expectedVersion } = command;
  const msg = app().messages[name];
  if (!msg || !msg.handlers.length)
    throw new RegistrationError(command as Message);
  const factory = app().artifacts[msg.handlers[0]]
    .factory as unknown as CommandHandlerFactory<S, C, E>;
  if (!factory) throw new RegistrationError(command as Message);
  log().trace("blue", `\n>>> ${factory.name}`, command, metadata);

  const { data } = validateMessage(command);
  const artifact = factory(id || "");
  Object.setPrototypeOf(artifact, factory as object);
  return await _handleMsg<S, C, E>(
    artifact,
    (state) => artifact.on[name](data, state, actor),
    {
      correlation: metadata?.correlation || randomId(),
      causation: {
        ...metadata?.causation,
        command: { actor, name, id, expectedVersion }
        // TODO: flag to include command.data in metadata, not included by default to avoid duplicated payloads
      }
    }
  );
};

/**
 * Handles event and optionally invokes command on target - side effect
 * @param factory the event handler factory
 * @param event the committed event payload
 * @returns optional command response and reducible state
 */
export const event = async <
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E>,
  event: CommittedEvent<E>
): Promise<{
  command: Command<C> | undefined;
  state?: S;
}> => {
  const { name, stream, id } = event;
  log().trace("magenta", `\n>>> ${factory.name}`, event);

  const artifact = factory(event);
  Object.setPrototypeOf(artifact, factory as object);
  const { data } = validateMessage(event);
  const metadata: CommittedEventMetadata = {
    correlation: event.metadata?.correlation || randomId(),
    causation: { event: { name, stream, id } }
  };
  let cmd: Command<C> | undefined;
  const snapshots = await _handleMsg(
    artifact,
    async (state) => {
      cmd = await artifact.on[name](event, state);
      cmd && (await command<S, C, E>(cmd, metadata)); // handles commands synchronously, thus policies can fail
      return [bind(name, data)];
    },
    metadata,
    false // dont notify events committed by process managers to avoid loops
  );
  return {
    command: cmd,
    state: snapshots.at(-1)?.state
  };
};

/**
 * Loads current snapshot of a reducible artifact
 * @param factory the reducible factory
 * @param id the reducible id
 * @param useSnapshots flag to use stored snapshots
 * @param callback optional reduction predicate to act on each snapshot
 * @returns current model state
 */
export const load = async <
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: ReducibleFactory<S, C, E>,
  id: string,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> => {
  const reducible = factory(id);
  Object.setPrototypeOf(reducible, factory as object);
  return _load<S, E>(reducible, useSnapshots, callback);
};

/**
 * Queries the store - all streams
 * @param query query parameters
 * @param callback event predicate
 * @returns number of events returned
 */
export const query = async (
  query: AllQuery,
  callback: (event: CommittedEvent) => void
): Promise<number> => await store().query(callback, query);
