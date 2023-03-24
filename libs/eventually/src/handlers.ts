import { ProjectorStore, SnapshotStore } from "./interfaces";
import { app, log, store, _imps } from "./ports";
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
  ProjectorFactory,
  Reducible,
  ReducibleFactory,
  RegistrationError,
  Snapshot,
  State,
  Streamable
} from "./types";
import { bind, randomId, validate, validateMessage } from "./utils";

/**
 * Loads reducible artifact from store
 * @param factory the reducible factory
 * @param reducible the reducible artifact
 * @param useSnapshots flag to use stored snapshots
 * @param callback optional reduction predicate
 * @returns current model snapshot
 */
const STATE_EVENT = "__state__";
const _load = async <S extends State, C extends Messages, E extends Messages>(
  factory: ReducibleFactory<S, C, E>,
  reducible: Reducible<S, E> & Streamable,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> => {
  const stream = reducible.stream;
  const snapStore =
    ((useSnapshots && app().stores.get(factory.name)) as SnapshotStore<S, E>) ||
    undefined;
  const snapshot = (snapStore && (await snapStore.read(stream))) || undefined;
  let state = snapshot?.state || reducible.init();
  let event = snapshot?.event;
  let applyCount = 0;
  let stateCount = 0;

  await store().query<E>(
    (e) => {
      event = e;
      if (e.name === STATE_EVENT) {
        if (app().artifacts.get(factory.name)?.type === "aggregate") {
          state = e.data as S;
          stateCount++;
        }
      } else if (reducible.reduce[e.name]) {
        state = reducible.reduce[e.name](state, e);
        applyCount++;
      }
      callback && callback({ event, state, applyCount, stateCount });
    },
    { stream, after: event?.id }
  );

  log().gray().trace(`   ... ${stream} loaded ${applyCount} event(s)`);

  return { event, state, applyCount, stateCount };
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
  const stream = "stream" in artifact ? artifact.stream : undefined;
  const reduce = "reduce" in artifact ? artifact.reduce : undefined;

  const snapshot =
    stream && reduce
      ? await _load(
          factory as ReducibleFactory<S, C, E>,
          artifact as Reducible<S, E> & Streamable
        )
      : ({ state: {} as S, applyCount: 0, stateCount: 0 } as Snapshot<S, E>);

  const events = await callback(snapshot);
  const commit = reduce && app().commits.get(factory.name);
  if (commit && commit(snapshot)) {
    events.push({
      name: STATE_EVENT,
      data: snapshot.state as Readonly<E[keyof E & string]>
    });
  }
  if (stream && events.length) {
    const committed = await store().commit(
      stream,
      events.map((e) => (e.name === STATE_EVENT ? e : validateMessage(e))),
      metadata,
      metadata.causation.command?.expectedVersion || snapshot.event?.version
    );
    if (reduce) {
      let { state, applyCount, stateCount } = snapshot;
      const snapshots = committed.map((event) => {
        log()
          .gray()
          .trace(
            `   ... ${stream} committed ${event.name} @ ${event.version}`,
            event.data
          );
        if (event.name === STATE_EVENT) {
          state = event.data as S;
          stateCount++;
        } else {
          state = reduce[event.name](state, event);
          applyCount++;
        }
        log()
          .gray()
          .trace(`   === ${JSON.stringify(state)}`, ` @ ${event.version}`);
        return { event, state, applyCount, stateCount } as Snapshot<S, E>;
      });
      app().emit("commit", { factory, snapshot: snapshots.at(-1) });
      return snapshots;
    } else {
      app().emit("commit", { factory });
      return committed.map(
        (event) => ({ state: snapshot.state, event } as Snapshot<S, E>)
      );
    }
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
  const { name, stream, expectedVersion, actor } = command;

  const msg = app().messages.get(name);
  if (!msg?.handlers.length) throw new RegistrationError(command);
  const factory = app().artifacts.get(msg.handlers[0])
    ?.factory as unknown as CommandHandlerFactory<S, C, E>;
  if (!factory) throw new RegistrationError(command);

  log().blue().trace(`\n>>> ${factory.name}`, command, metadata);

  const artifact = factory(stream || "");
  Object.setPrototypeOf(artifact, factory as object);
  const snapshots = await _handleMsg<S, C, E>(
    factory,
    artifact,
    ({ state }) => artifact.on[name](validated.data, state, actor),
    {
      correlation: metadata?.correlation || randomId(),
      causation: {
        ...metadata?.causation,
        command: { name, stream, expectedVersion, actor }
        // TODO: flag to include command.data in metadata, not included by default to avoid duplicated payloads
      }
    }
  );
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
  stream: string,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> => {
  const reducible = factory(stream);
  Object.setPrototypeOf(reducible, factory as object);
  return _load<S, C, E>(factory, reducible, useSnapshots, callback);
};

export const query = async (
  query: AllQuery,
  callback: (event: CommittedEvent) => void
): Promise<number> => await store().query(callback, query);

export const project = async <S extends State, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  event: CommittedEvent<E>
): Promise<ProjectionResults<S>> => {
  log().green().trace(`\n>>> ${factory.name}`, event);

  validateMessage(event);
  const artifact = factory();
  Object.setPrototypeOf(artifact, factory as object);

  const projection = await artifact.on[event.name](event);
  const projStore =
    (app().stores.get(factory.name) as ProjectorStore<S>) || _imps();
  const results = await projStore.commit(projection, event.id);
  app().emit("projection", { factory, results });
  log()
    .gray()
    .trace(
      "   ... committed",
      JSON.stringify(projection),
      JSON.stringify(results)
    );
  return results;
};

export const read = async <S extends State, E extends Messages>(
  factory: ProjectorFactory<S, E>,
  query: string | string[] | ProjectionQuery<S>,
  callback: (record: ProjectionRecord<S>) => void
): Promise<number> => {
  const projStore =
    (app().stores.get(factory.name) as ProjectorStore<S>) || _imps();
  const ids =
    typeof query === "string"
      ? [query]
      : Array.isArray(query)
      ? query
      : undefined;
  if (ids) {
    const records = await projStore.load(ids);
    records.forEach((record) => callback(record));
    return records.length;
  }
  return projStore.query(query as ProjectionQuery<S>, callback);
};
