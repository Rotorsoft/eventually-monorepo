import { z, ZodRawShape, ZodType, ZodTypeAny } from "zod";
import {
  ActorHandler,
  CommandHandler,
  EventHandler,
  EventReducer,
  Invariant
} from "./handlers";
import {
  Command,
  CommittedEvent,
  Messages,
  Projection,
  State,
  StateWithId
} from "./messages";

export type ArtifactType =
  | "aggregate"
  | "system"
  | "policy"
  | "process-manager"
  | "command-adapter"
  | "projector";

/** Empty message payload */
export type Empty = Record<string, never>;
/** Empty message payload schema */
export const ZodEmpty = z.record(z.never());
/** Infers zod types */
export type Infer<T> = T extends ZodRawShape
  ? {
      [K in keyof T]: z.infer<T[K]>;
    }
  : T extends ZodTypeAny
  ? z.infer<T>
  : never;

/**
 * All artifacts transferred from models have
 * - `description` to help with documentation
 */
export type WithDescription = {
  description: string;
};

/**
 * Command handling artifacts have
 * - `schemas.commands` schemas for input validation
 * - `schemas.events` schemas for output validation
 * - `on` command handlers
 */
export type WithCommandHandlers<
  S extends State,
  C extends Messages,
  E extends Messages
> = {
  schemas: {
    commands: { [K in keyof C]: ZodType<C[K]> };
    events: { [K in keyof E]: ZodType<E[K]> };
  };
  on: { [K in keyof C]: CommandHandler<S, C, E, K> };
};

/**
 * Event handling artifacts have
 * - `schemas.events` schemas for input validation
 * - `on` event handlers
 */
export type WithEventHandlers<
  S extends State,
  C extends Messages,
  E extends Messages
> = {
  schemas: {
    events: { [K in keyof E]: ZodType<E[K]> };
  };
  on: {
    [K in keyof E]: EventHandler<S, C, E, K>;
  };
};

/**
 * Command producing artifacts have
 * - `schemas.commands` produced command names to help with documentation
 */
export type WithCommandOutputs<C extends Messages> = {
  schemas: {
    commands: { [K in keyof C]: ZodType<C[K]> };
  };
};

/**
 * Streamable artifacts commit events to named streams
 */
export type Streamable = WithDescription & {
  readonly stream: string;
};

/**
 * Reducible artifacts reduce state from event streams
 * - `schemas.state` schema to help with documentation
 * - `init` state initializer
 * - `reduce` event reducers
 */
export type Reducible<
  S extends State = State,
  E extends Messages = Messages
> = WithDescription & {
  schemas: {
    state: ZodType<S>;
  };
  init: () => Readonly<S>;
  reduce: { [K in keyof E]: EventReducer<S, E, K> };
};

/**
 * Aggregates handle commands and produce committed events while holding internal reducible state
 * - Provide consistency boundaries in a business model
 * - `schemas.events` schemas for commit validation
 * - `given?` array of invariant handlers
 */
export type Aggregate<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = Streamable &
  Reducible<S, E> &
  WithCommandHandlers<S, C, E> & {
    schemas: {
      events: { [K in keyof E]: ZodType<E[K]> };
    };
    given?: { [K in keyof C]?: Array<Invariant<S>> };
  };

/**
 * Systems handle commands and produce committed events without internal state
 */
export type System<
  C extends Messages = Messages,
  E extends Messages = Messages
> = Streamable & WithCommandHandlers<State, C, E>;

/**
 * Policies handle events and can produce commands that trigger local command handlers synchronously
 */
export type Policy<
  C extends Messages = Messages,
  E extends Messages = Messages
> = WithDescription & WithEventHandlers<State, C, E> & WithCommandOutputs<C>;

/**
 * Process managers are policies with reducible state, used to expand a consistency boundary around aggregates
 * - Generates actor ids to reduce its state from events with actor = id
 * - Invokes commands on the expanded aggregates, appending the actor id to the committed events
 * - `actor` actor id resolvers from input events
 */
export type ProcessManager<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages,
  O extends Messages = Messages
> = Reducible<S, O> &
  WithEventHandlers<S, C, E> &
  WithCommandOutputs<C> & {
    actor: { [K in keyof E]: ActorHandler<E, K> };
  };

/**
 * Projectors handle events and produce slices of filters/values representing the area being created/merged or deleted
 * - `schemas.state` state schema to help with documentation
 * - `schemas.events` event schemas for input validation
 * - `on` projection handlers
 */
export type Projector<
  S extends State = State,
  E extends Messages = Messages
> = WithDescription & {
  schemas: {
    state: ZodType<StateWithId<S>>;
    events: { [K in keyof E]: ZodType<E[K]> };
  };
  on: {
    [K in keyof E]: (
      event: CommittedEvent<Pick<E, K>>
    ) => Promise<Projection<S>>;
  };
};

/**
 * Command adapters map any message payload to commands
 * - These are policies with generic inputs (not committed events)
 * - `schemas.message` message schema for input validation
 * - `on` command adapter
 */
export type CommandAdapter<
  S extends State = State,
  C extends Messages = Messages
> = WithDescription &
  WithCommandOutputs<C> & {
    schemas: {
      message: ZodType<S>;
    };
    on: (message: Readonly<S>) => Command<C>;
  };

/**
 * All command handling artifacts
 */
export type CommandHandlingArtifact<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = Aggregate<S, C, E> | System<C, E>;

/**
 * All event handling artifacts
 */
export type EventHandlingArtifact<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages,
  O extends Messages = Messages
> = ProcessManager<S, C, E, O> | Policy<C, E>;

/**
 * All message handling artifacts
 */
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
