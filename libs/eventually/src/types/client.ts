import type {
  AggregateFactory,
  CommandAdapterFactory,
  CommandHandlerFactory,
  EventHandlerFactory,
  ProjectorFactory
} from "./factories";
import type {
  AllQuery,
  Command,
  CommandTarget,
  CommittedEvent,
  Messages,
  Snapshot,
  State
} from "./messages";
import type {
  AggQuery,
  AggResult,
  ProjectionQuery,
  ProjectionRecord,
  ProjectionResults
} from "./projection";

/**
 * Response from event handlers
 *
 * - `id`: the event id
 * - `error?`: error message when failed
 * - `command?` the command triggered by the event handler when handled by policies
 * - `state?` the reducible state when handled by process managers
 */
export type EventResponse<S extends State, C extends Messages> = {
  readonly id: number;
  readonly error?: string;
  readonly command?: Command<C>;
  readonly state?: S;
};

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
   * @param factory the command handler factory (aggregate or system)
   * @param name the command name
   * @param data the command payload
   * @param target the command target
   * @returns array of snapshots produced by this command
   */
  command: <
    S extends State,
    C extends Messages,
    E extends Messages,
    N extends keyof C & string
  >(
    factory: CommandHandlerFactory<S, C, E>,
    name: N,
    data: Readonly<C[N]>,
    target: CommandTarget
  ) => Promise<Snapshot<S, E>[]>;

  /**
   * Validates and handles event message
   * @param factory the event handler factory (policy, process manager, or projector)
   * @param event the committed event to be handled
   * @returns response, including command or projection side effects
   */
  event: <S extends State, C extends Messages, E extends Messages>(
    factory: EventHandlerFactory<S, C, E>,
    event: CommittedEvent<E>
  ) => Promise<EventResponse<S, C>>;

  /**
   * Loads current aggregate snapshot
   * @param factory the aggregate factory
   * @param stream the aggregate stream id
   * @param callback optional reduction predicate to act on each snapshot
   * @returns current model state
   */
  load: <S extends State, C extends Messages, E extends Messages>(
    reducible: AggregateFactory<S, C, E>,
    stream: string,
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
   * Projects events into a projection
   * @param factory the projector factory
   * @param events the committed events to project
   * @returns the projection
   */
  project: <S extends State, E extends Messages>(
    factory: ProjectorFactory<S, E>,
    events: CommittedEvent<E>[]
  ) => Promise<ProjectionResults>;

  /**
   * Reads projection records by id or query
   * @param factory the projector factory
   * @param query the record id(s) or a query
   * @returns the matched records
   */
  read: <S extends State, E extends Messages>(
    factory: ProjectorFactory<S, E>,
    query: string | string[] | ProjectionQuery<S>
  ) => Promise<ProjectionRecord<S>[]>;

  /**
   * Aggregates projection records
   * @param factory the projector factory
   * @param query the aggregate query
   * @returns the aggregate results
   */
  agg: <S extends State, E extends Messages>(
    factory: ProjectorFactory<S, E>,
    query: AggQuery<S>
  ) => Promise<AggResult<S>>;
};
