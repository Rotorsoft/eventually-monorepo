import { z, ZodType } from "zod";
import { Messages, State, Command } from "./messages";
import { EventReducer, CommandHandler, EventHandler } from "./handlers";

/** Empty message payload */
export type Empty = Record<string, never>;
/** Empty message payload schema */
export const ZodEmpty = z.record(z.never());

/**
 * All artifacts transferred from models have a description to help with documentation
 */
export type Artifact = {
  description: string;
};

/**
 * For artifacts with command handlers
 * - command schemas for input validation
 * - event schemas for output validation
 */
type WithCommandHandlers<
  S extends State,
  C extends Messages,
  E extends Messages
> = {
  schemas: {
    commands: { [K in keyof C]: ZodType<C[K]> };
    events: { [K in keyof E]: ZodType<E[K]> };
  };
  on: { [K in keyof C & string]: CommandHandler<S, C, E, K> };
};

/**
 * For artifacts with event handlers
 * - event schemas for input validation
 */
type WithEventHandlers<
  S extends State,
  C extends Messages,
  E extends Messages
> = {
  schemas: {
    events: { [K in keyof E]: ZodType<E[K]> };
  };
  on: {
    [K in keyof E & string]: EventHandler<S, C, E, K>;
  };
};

/**
 * For command producing artifacts
 * - list all command names to help with documentation
 */
type WithCommandOutputs<C extends Messages> = {
  schemas: {
    commands: Array<keyof C>; // TODO: find way to force all keys in C
  };
};

/**
 * Streamable artifacts commit events to named streams
 */
export type Streamable = Artifact & {
  stream: () => string;
};

/**
 * Reducible artifacts reduce state from event streams
 * - state schema is provided to help with documentation
 */
export type Reducible<
  S extends State = State,
  E extends Messages = Messages
> = Streamable & {
  schemas: {
    state: ZodType<S>;
    events: { [K in keyof E]: ZodType<E[K]> };
  };
  init: () => Readonly<S>;
  reduce: { [K in keyof E & string]: EventReducer<S, E, K> };
};

/**
 * Aggregates handle commands and produce committed events while holding internal state
 * - These are the artifacts that define state consistency boundaries in a business model
 */
export type Aggregate<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = Reducible<S, E> & WithCommandHandlers<S, C, E>;

/**
 * Systems handle commands and produce committed events without internal state
 */
export type System<
  C extends Messages = Messages,
  E extends Messages = Messages
> = Streamable & WithCommandHandlers<State, C, E>;

/**
 * Policies handle events and can produce commands
 */
export type Policy<
  C extends Messages = Messages,
  E extends Messages = Messages
> = Artifact & WithEventHandlers<State, C, E> & WithCommandOutputs<C>;

/**
 * Process managers are policies with reducible state
 * - Allowing to expand consistency boundaries from multiple events into local state machines
 */
export type ProcessManager<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = Reducible<S, E> & WithEventHandlers<S, C, E> & WithCommandOutputs<C>;

/**
 * Command adapters convert messages to commands
 * - This is a "Policy" with a generic input not following the committed event schema
 */
export type CommandAdapter<
  S extends State = State,
  C extends Messages = Messages
> = Artifact &
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
  E extends Messages = Messages
> = ProcessManager<S, C, E> | Policy<C, E>;

/**
 * All message handling artifacts
 */
export type MessageHandlingArtifact<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> =
  | CommandHandlingArtifact<S, C, E>
  | EventHandlingArtifact<S, C, E>
  | CommandAdapter<S, C>;
