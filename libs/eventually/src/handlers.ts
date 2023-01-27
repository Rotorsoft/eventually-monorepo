import { ProjectorStore, SnapshotStore } from "./interfaces";
import { app, broker, log, store, _imps } from "./ports";
import {
  AllQuery,
  Artifact,
  ArtifactFactory,
  Command,
  CommandAdapterFactory,
  CommandHandlerFactory,
  CommittedEvent,
  CommittedEventMetadata,
  EventHandlerFactory,
  EventResponse,
  Message,
  Messages,
  ProjectionQuery,
  ProjectionRecord,
  ProjectionResults,
  ProjectionState,
  ProjectorFactory,
  Reducible,
  ReducibleFactory,
  RegistrationError,
  Snapshot,
  State,
  Streamable,
  StreamableFactory
} from "./types";
import { bind, randomId, validate, validateMessage } from "./utils";

/**
 * Process manager streams are prefixed with the factory name
 */
const _stream = <S extends State, C extends Messages, E extends Messages>(
  factory: StreamableFactory<S, C, E>,
  streamable: Streamable
): string =>
  app().artifacts[factory.name].type === "process-manager"
    ? factory.name.concat(":", streamable.stream())
    : streamable.stream();

/**
 * Loads reducible artifact from store
 * @param factory the reducible factory
 * @param reducible the reducible artifact
 * @param useSnapshots flag to use stored snapshots
 * @param callback optional reduction predicate
 * @returns current model snapshot
 */
const _load = async <S extends State, C extends Messages, E extends Messages>(
  factory: ReducibleFactory<S, C, E>,
  reducible: Reducible<S, E> & Streamable,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> => {
  const stream = _stream(factory, reducible);
  const snapStore =
    ((useSnapshots && app().stores[factory.name]) as SnapshotStore) ||
    undefined;
  const snapshot =
    (snapStore && (await snapStore.read<S, E>(stream))) || undefined;
  let state = snapshot?.state || reducible.init();
  let event = snapshot?.event;
  let applyCount = 0;

  await store().query<E>(
    (e) => {
      event = e;
      state = reducible.reduce[event.name](state as Readonly<S>, event);
      applyCount++;
      callback && callback({ event, state, applyCount });
    },
    { stream, after: event?.id }
  );

  log().gray().trace(`   ... ${stream} loaded ${applyCount} event(s)`);

  return { event, state, applyCount };
};

/**
 * Generic message handler
 * @param factory the artifact factory
 * @param artifact the message handling artifact
 * @param callback the message handling callback
 * @param metadata the message metadata
 * @returns reduced snapshots of new events when artifact is reducible
 */
const _handleMsg = async <
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: ArtifactFactory<S, C, E>,
  artifact: Artifact<S, C, E>,
  callback: (snapshot: Snapshot<S>) => Promise<Message<E>[]>,
  metadata: CommittedEventMetadata
): Promise<Snapshot<S, E>[]> => {
  const stream =
    "stream" in artifact
      ? _stream(factory as StreamableFactory<S, C, E>, artifact)
      : undefined;
  const reduce = "reduce" in artifact ? artifact.reduce : undefined;

  const snapshot =
    stream && reduce
      ? await _load(
          factory as ReducibleFactory<S, C, E>,
          artifact as Reducible<S, E> & Streamable
        )
      : { state: {} as S, applyCount: 0 };

  const events = await callback(snapshot);
  if (stream && events.length) {
    const committed = await store().commit(
      stream,
      events.map(validateMessage),
      metadata,
      metadata.causation.command?.expectedVersion || snapshot.event?.version
    );
    if (reduce) {
      let state = snapshot.state;
      const snapshots = committed.map((event) => {
        log()
          .gray()
          .trace(
            `   ... ${stream} committed ${event.name} @ ${event.version}`,
            event.data
          );
        state = reduce[event.name](state, event);
        log()
          .gray()
          .trace(`   === ${JSON.stringify(state)}`, ` @ ${event.version}`);
        return { event, state } as Snapshot<S, E>;
      });
      const snapStore = app().stores[factory.name || ""] as SnapshotStore;
      if (snapStore && snapshot.applyCount > snapStore.threshold) {
        try {
          // TODO: implement reliable async snapshotting from persisted queue started by app
          await snapStore.upsert(stream, snapshots.at(-1) as Snapshot);
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
  const validated = validate(payload, adapter.schemas.message);
  return command(adapter.on(validated));
};

export const command = async <
  S extends State,
  C extends Messages,
  E extends Messages
>(
  command: Command<C>,
  metadata?: CommittedEventMetadata
): Promise<Snapshot<S, E>[]> => {
  const validated = validateMessage(command);
  const { name, id, expectedVersion, actor } = command;

  const msg = app().messages[name];
  if (!msg.handlers.length) throw new RegistrationError(command);
  const factory = app().artifacts[msg.handlers[0]]
    .factory as unknown as CommandHandlerFactory<S, C, E>;
  if (!factory) throw new RegistrationError(command);

  log().blue().trace(`\n>>> ${factory.name}`, command, metadata);

  const artifact = factory(id || "");
  Object.setPrototypeOf(artifact, factory as object);
  const snapshots = await _handleMsg<S, C, E>(
    factory,
    artifact,
    ({ state }) => artifact.on[name](validated.data, state, actor),
    {
      correlation: metadata?.correlation || randomId(),
      causation: {
        ...metadata?.causation,
        command: { name, id, expectedVersion, actor }
        // TODO: flag to include command.data in metadata, not included by default to avoid duplicated payloads
      }
    }
  );
  snapshots.length && (await broker().poll());
  return snapshots;
};

export const event = async <
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E>,
  event: CommittedEvent<E>
): Promise<EventResponse<S, C>> => {
  const { name, stream, id } = event;
  log().magenta().trace(`\n>>> ${factory.name}`, event);

  const artifact = factory(event);
  Object.setPrototypeOf(artifact, factory as object);
  const { data } = validateMessage(event);
  const metadata: CommittedEventMetadata = {
    correlation: event.metadata?.correlation || randomId(),
    causation: { event: { name, stream, id } }
  };
  let cmd: Command<C> | undefined;
  const snapshots = await _handleMsg(
    factory,
    artifact,
    async (snapshot) => {
      // ensure process managers are idempotent
      if (snapshot && snapshot.event && event.id <= snapshot.event.id)
        return [];
      // command side effects are handled synchronously, thus event handlers can fail
      cmd = await artifact.on[name](event, snapshot.state);
      cmd && (await command<S, C, E>(cmd, metadata));
      return [bind(name, data)];
    },
    metadata
  );
  return {
    command: cmd,
    state: snapshots.at(-1)?.state
  };
};

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
  return _load<S, C, E>(factory, reducible, useSnapshots, callback);
};

export const query = async (
  query: AllQuery,
  callback: (event: CommittedEvent) => void
): Promise<number> => await store().query(callback, query);

export const project = async <S extends ProjectionState, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  event: CommittedEvent<E>
): Promise<ProjectionResults<S>> => {
  log().green().trace(`\n>>> ${factory.name}`, event);

  validateMessage(event);
  const artifact = factory();
  Object.setPrototypeOf(artifact, factory as object);

  const projection = await artifact.on[event.name](event);
  const projStore = (app().stores[factory.name] as ProjectorStore) || _imps();
  const committed = await projStore.commit(projection, event.id);
  log()
    .gray()
    .trace(
      "   ... committed",
      JSON.stringify(projection),
      JSON.stringify(committed)
    );
  return committed;
};

export const read = async <S extends ProjectionState, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  query: string | string[] | ProjectionQuery<S>,
  callback: (record: ProjectionRecord<S>) => void
): Promise<number> => {
  const projStore = (app().stores[factory.name] as ProjectorStore) || _imps();
  const ids =
    typeof query === "string"
      ? [query]
      : Array.isArray(query)
      ? query
      : undefined;
  if (ids) {
    const records = await projStore.load<S>(ids);
    records.forEach((record) => callback(record));
    return records.length;
  }
  return projStore.query<S>(query as ProjectionQuery<S>, callback);
};
