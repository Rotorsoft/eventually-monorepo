import { ProjectorStore, SnapshotStore } from "./interfaces";
import { _imps, app, log, store } from "./ports";
import {
  AggregateFactory,
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
  InvariantError,
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
import { bind, clone, randomId, validate, validateMessage } from "./utils";

/**
 * Loads reducible artifact from store
 * @param factory the reducible factory
 * @param reducible the reducible artifact
 * @param filter the event filter (stream or actor)
 * @param useSnapshots flag to use stored snapshots
 * @param callback optional reduction predicate
 * @returns current model snapshot
 */
const STATE_EVENT = "__state__";
const _reduce = async <S extends State, C extends Messages, E extends Messages>(
  factory: ReducibleFactory<S, C, E>,
  reducible: Reducible<S, E>,
  filter: string,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> => {
  const type = app().artifacts.get(factory.name)?.type;
  const snapStore =
    ((useSnapshots && app().stores.get(factory.name)) as SnapshotStore<S, E>) ||
    undefined;
  const snapshot =
    (type === "aggregate" && snapStore && (await snapStore.read(filter))) ||
    undefined;
  let state = snapshot?.state || reducible.init();
  let event = snapshot?.event;
  let applyCount = 0;
  let stateCount = 0;

  await store().query<E>(
    (e) => {
      event = e;
      if (e.name === STATE_EVENT) {
        if (type === "aggregate") {
          state = e.data as S;
          stateCount++;
        }
      } else if (reducible.reduce[e.name]) {
        state = clone(state, reducible.reduce[e.name](state, e));
        applyCount++;
      }
      callback && callback({ event, state, applyCount, stateCount });
    },
    type === "aggregate"
      ? { stream: filter, after: event?.id }
      : { actor: filter }
  );

  log().gray().trace(`   ... ${filter} loaded ${applyCount} event(s)`);

  return { event, state, applyCount, stateCount };
};

/**
 * Generic message handler
 * @param factory the artifact factory
 * @param artifact the message handling artifact
 * @param filter the event filter (stream or actor)
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
  filter: string,
  callback: (snapshot: Snapshot<S>) => Promise<Message<E>[]>,
  metadata: CommittedEventMetadata
): Promise<Snapshot<S, E>[]> => {
  const stream = "stream" in artifact ? artifact.stream : undefined;
  const reduce = "reduce" in artifact ? artifact.reduce : undefined;

  const snapshot = reduce
    ? await _reduce(
        factory as ReducibleFactory<S, C, E>,
        artifact as Reducible<S, E> & Streamable,
        filter
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
          state = clone(state, reduce[event.name](state, event));
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
  if (!stream) throw new Error("Missing target stream");

  const msg = app().messages.get(name);
  if (!msg?.handlers.length) throw new RegistrationError(command);

  const factory = app().artifacts.get(msg.handlers[0])
    ?.factory as unknown as CommandHandlerFactory<S, C, E>;
  if (!factory) throw new RegistrationError(command);

  log().blue().trace(`\n>>> ${factory.name}`, command, metadata);

  const artifact = factory(stream);
  Object.setPrototypeOf(artifact, factory as object);

  const snapshots = await _handleMsg<S, C, E>(
    factory,
    artifact,
    stream,
    ({ state }) => {
      if ("given" in artifact && artifact.given) {
        const invariants = artifact.given[name] || [];
        invariants.forEach((invariant) => {
          if (!invariant.valid(state, actor))
            throw new InvariantError<C>(
              name,
              command.data,
              { stream, expectedVersion, actor },
              invariant.description
            );
        });
      }
      return artifact.on[name](validated.data, state, actor);
    },
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

  const artifact = factory();
  Object.setPrototypeOf(artifact, factory as object);
  const { data } = validateMessage(event);
  const metadata: CommittedEventMetadata = {
    correlation: event.metadata?.correlation || randomId(),
    causation: { event: { name, stream, id } }
  };
  let cmd: Command<C> | undefined;
  const actor: string = "actor" in artifact ? artifact.actor[name](event) : "";
  const snapshots = await _handleMsg(
    factory,
    artifact,
    actor,
    async (snapshot) => {
      cmd = await artifact.on[name](event, snapshot.state);
      if (cmd) {
        // command side effects are handled synchronously, thus event handlers can fail
        await command<S, C, E>(
          {
            ...cmd,
            actor: {
              id: actor || factory.name,
              name: factory.name,
              expectedCount: actor ? snapshot.applyCount : undefined
            }
          },
          metadata
        );
      }
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
  factory: AggregateFactory<S, C, E>,
  stream: string,
  useSnapshots = true,
  callback?: (snapshot: Snapshot<S, E>) => void
): Promise<Snapshot<S, E>> => {
  const reducible = factory(stream);
  Object.setPrototypeOf(reducible, factory as object);
  return _reduce<S, C, E>(factory, reducible, stream, useSnapshots, callback);
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
