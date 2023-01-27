import {
  AllQuery,
  CommandAdapterFactory,
  CommandHandlerFactory,
  CommandTarget,
  CommittedEvent,
  EventHandlerFactory,
  EventResponse,
  Messages,
  ProjectorFactory,
  ProjectionRecord,
  ProjectionResults,
  ReducibleFactory,
  Snapshot,
  State,
  ProjectionState,
  ProjectionQuery
} from ".";

export type Client = {
  /**
   * Invokes command through adapter
   * @param factory adapter factory
   * @param payload message payload
   */
  invoke: <
    P extends State,
    S extends State,
    C extends Messages,
    E extends Messages
  >(
    factory: CommandAdapterFactory<P, C>,
    payload: P
  ) => Promise<Snapshot<S, E>[]>;

  /**
   * Handles command
   * @param factory the command handler factory
   * @param name the command name
   * @param data the command payload
   * @param target the command target
   * @returns array of snapshots produced by this command
   */
  command: <S extends State, C extends Messages, E extends Messages>(
    factory: CommandHandlerFactory<S, C, E>,
    name: keyof C,
    data: Readonly<C[keyof C]>,
    target?: CommandTarget
  ) => Promise<Snapshot<S, E>[]>;

  /**
   * Handles event and optionally invokes command on target - side effect
   * @param factory the event handler factory
   * @param event the committed event
   * @returns optional command response and reducible state
   */
  event: <S extends State, C extends Messages, E extends Messages>(
    factory: EventHandlerFactory<S, C, E>,
    event: CommittedEvent<E>
  ) => Promise<EventResponse<S, C>>;

  /**
   * Loads current snapshot of a reducible artifact
   * @param factory the reducible factory
   * @param id the reducible id
   * @param useSnapshots flag to use stored snapshots
   * @param callback optional reduction predicate to act on each snapshot
   * @returns current model state
   */
  load: <S extends State, C extends Messages, E extends Messages>(
    reducible: ReducibleFactory<S, C, E>,
    id: string,
    useSnapshots?: boolean,
    callback?: (snapshot: Snapshot<S, E>) => void
  ) => Promise<Snapshot<S, E>>;

  /**
   * Queries the store - all streams
   * @param query query parameters
   * @param callback optional event predicate
   * @returns query summary
   */
  query: (
    query: AllQuery,
    callback?: (event: CommittedEvent) => void
  ) => Promise<{
    first?: CommittedEvent;
    last?: CommittedEvent;
    count: number;
  }>;

  /**
   * Projects event into projector store
   * @param factory the projector factory
   * @param event the committed event
   * @returns the committed projection
   */
  project: <S extends ProjectionState, E extends Messages>(
    factory: ProjectorFactory<S, E>,
    event: CommittedEvent<E>
  ) => Promise<ProjectionResults<S>>;

  /**
   * Reads projection records by id or query
   * @param factory the projector factory
   * @param query the record id(s) or a more complex query
   * @param callback record predicate
   * @returns the number of records matched
   */
  read: <S extends ProjectionState, E extends Messages>(
    factory: ProjectorFactory<S, E>,
    query: string | string[] | ProjectionQuery<S>,
    callback: (record: ProjectionRecord<S>) => void
  ) => Promise<number>;
};
