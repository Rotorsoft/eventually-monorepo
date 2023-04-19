import { z, ZodRawShape, ZodType, ZodTypeAny } from "zod";
import {
  ActorHandler,
  CommandHandler,
  EventHandler,
  EventReducer,
  Invariant,
  StateReducer
} from "./handlers";
import {
  Command,
  CommittedEvent,
  Messages,
  Projection,
  State,
  StateWithId
} from "./messages";

/** All artifact types */
export type ArtifactType =
  | "system"
  | "aggregate"
  | "policy"
  | "process-manager"
  | "command-adapter"
  | "projector";

/** Empty message payload */
export type Empty = Record<string, never>;

/** Empty message payload schema */
export const ZodEmpty = z.record(z.never());

/**
 * All artifacts must have
 * - `description` to help with documentation
 */
export type WithDescription = { description: string };

/** Schemas define message validation */
export type Schemas<M extends Messages> = { [K in keyof M]: ZodType<M[K]> };

/**
 * System schemas for
 * - `schemas.commands` input validation
 * - `schemas.events` output validation
 */
export type SystemSchemas<C extends Messages, E extends Messages> = {
  commands: Schemas<C>;
  events: Schemas<E>;
};

/**
 * Aggregate schemas for
 * - `schemas.state` state documentation
 * - `schemas.commands` input validation
 * - `schemas.events` output validation
 */
export type AggregateSchemas<
  S extends State,
  C extends Messages,
  E extends Messages
> = {
  state: ZodType<S>;
  commands: Schemas<C>;
  events: Schemas<E>;
};

/**
 * Policy schemas for
 * - `schemas.commands` output documentation
 * - `schemas.events` input validation
 */
export type PolicySchemas<C extends Messages, E extends Messages> = {
  commands: Schemas<C>;
  events: Schemas<E>;
};

/**
 * ProcessManager schemas for
 * - `schemas.state` state documentation
 * - `schemas.commands` output documentation
 * - `schemas.events` input validation
 */
export type ProcessManagerSchemas<
  S extends State,
  C extends Messages,
  E extends Messages
> = {
  state: ZodType<S>;
  commands: Schemas<C>;
  events: Schemas<E>;
};

/**
 * CommandAdapter schemas for
 * - `schemas.message` input validation
 * - `schemas.commands` output documentation
 */
export type CommandAdapterSchemas<S extends State, C extends Messages> = {
  message: ZodType<S>;
  commands: Schemas<C>;
};

/**
 * Projector schemas for
 * - `schemas.state` state documentation
 * - `schemas.events` input validation
 */
export type ProjectorSchemas<S extends State, E extends Messages> = {
  state: ZodType<StateWithId<S>>;
  events: Schemas<E>;
};

/** Streamable artifacts commit events to named streams */
export type Streamable = WithDescription & { readonly stream: string };

/**
 * Reducible artifacts reduce their state from event streams
 * - `init` state initializer
 * - `reduce` event reducers
 * - `reducer?` state reducer
 * @see `utils.clone` for default state reducer behavior
 */
export type Reducible<
  S extends State = State,
  E extends Messages = Messages
> = WithDescription & {
  init: () => Readonly<S>;
  reduce: { [K in keyof E]: EventReducer<S, E, K> };
  reducer?: StateReducer<S>;
};

/**
 * Systems handle commands and produce a stream of committed events
 * - `schemas` for message validation and documentation
 * - `on` command handlers
 */
export type System<
  C extends Messages = Messages,
  E extends Messages = Messages
> = Streamable & {
  schemas: SystemSchemas<C, E>;
  on: { [K in keyof C]: CommandHandler<State, C, E, K> };
};

/**
 * Aggregates handle commands and produce committed events while holding an internal reducible state.
 * Aggregates enforce a consistency boundaries around business models.
 * - `schemas` for message validation and documentation
 * - `given?` array of invariant handlers
 * - `on` command handlers
 */
export type Aggregate<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = Streamable &
  Reducible<S, E> & {
    schemas: AggregateSchemas<S, C, E>;
    given?: { [K in keyof C]?: Array<Invariant<S>> };
    on: { [K in keyof C]: CommandHandler<S, C, E, K> };
  };

/**
 * Policies handle events and can invoke local commands synchronously
 * - `schemas` for message validation and documentation
 * - `on` event handlers
 */
export type Policy<
  C extends Messages = Messages,
  E extends Messages = Messages
> = WithDescription & {
  schemas: PolicySchemas<C, E>;
  on: { [K in keyof E]: EventHandler<State, C, E, K> };
};

/**
 * Process managers are policies with reducible state, used to expand a consistency boundary around aggregates.
 * Each process is an actor with reduced state from the `O`utput events emitted by the aggregates it encapsulates.
 * - `schemas` for message validation and documentation
 * - `actor` actor id resolvers from input events
 * - `on` event handlers
 */
export type ProcessManager<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages,
  O extends Messages = Messages
> = Reducible<S, O> & {
  schemas: ProcessManagerSchemas<S, C, E>;
  actor: { [K in keyof E]: ActorHandler<E, K> };
  on: { [K in keyof E]: EventHandler<S, C, E, K> };
};

/**
 * Command adapters map message payloads to commands.
 * Equivalent to policies with generic inputs instead of committed events.
 * - `schemas` for message validation and documentation
 * - `on` command adapter
 */
export type CommandAdapter<
  S extends State = State,
  C extends Messages = Messages
> = WithDescription & {
  schemas: CommandAdapterSchemas<S, C>;
  on: (message: Readonly<S>) => Command<C>;
};

/**
 * Projectors handle events that produce slices of filters/values representing the area of the data being projected -- created/merged or deleted
 * - `schemas` for message validation and documentation
 * - `on` projection handlers
 */
export type Projector<
  S extends State = State,
  E extends Messages = Messages
> = WithDescription & {
  schemas: ProjectorSchemas<S, E>;
  on: {
    [K in keyof E]: (
      event: CommittedEvent<Pick<E, K>>
    ) => Promise<Projection<S>>;
  };
};

/** All command handling artifacts */
export type CommandHandlingArtifact<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = Aggregate<S, C, E> | System<C, E>;

/** All event handling artifacts */
export type EventHandlingArtifact<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages,
  O extends Messages = Messages
> = ProcessManager<S, C, E, O> | Policy<C, E>;

/** All message handling artifacts */
export type Artifact<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages,
  O extends Messages = Messages
> =
  | CommandHandlingArtifact<S, C, E>
  | EventHandlingArtifact<S, C, E, O>
  | CommandAdapter<S, C>
  | Projector<S, E>;

/** Helper to infer zod types */
export type Infer<T> = T extends ZodRawShape
  ? {
      [K in keyof T]: z.infer<T[K]>;
    }
  : T extends ZodTypeAny
  ? z.infer<T>
  : never;

/** Helper to infer system types from schemas */
export type InferSystem<Z> = Z extends SystemSchemas<infer C, infer E>
  ? System<C, E>
  : never;

/** Helper to infer aggregate types from schemas */
export type InferAggregate<Z> = Z extends AggregateSchemas<
  infer S,
  infer C,
  infer E
>
  ? Aggregate<S, C, E>
  : never;

/** Helper to infer policy types from schemas */
export type InferPolicy<Z> = Z extends PolicySchemas<infer C, infer E>
  ? Policy<C, E>
  : never;

/** Helper to infer process manager types from schemas */
export type InferProcessManager<
  Z,
  O extends Messages
> = Z extends ProcessManagerSchemas<infer S, infer C, infer E>
  ? ProcessManager<S, C, E, O>
  : never;

/** Helper to infer command adapter types from schemas */
export type InferCommandAdapter<Z> = Z extends CommandAdapterSchemas<
  infer S,
  infer C
>
  ? CommandAdapter<S, C>
  : never;

/** Helper to infer projector types from schemas */
export type InferProjector<Z> = Z extends ProjectorSchemas<infer S, infer E>
  ? Projector<S, E>
  : never;
