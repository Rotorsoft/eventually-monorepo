import { ZodType } from "zod";
import { Messages, State, Command } from "./messages";
import { EventReducer, CommandHandler, EventHandler } from "./handlers";

/**
 * Artifacts handle messages
 */
export type Artifact<
  C extends Messages = Messages,
  E extends Messages = Messages
> = {
  description: string;
  schemas: {
    commands: { [K in keyof C]: ZodType<C[K]> };
    events: { [K in keyof E]: ZodType<E[K]> };
  };
};

/**
 * Streamable artifacts commit events to streams
 */
export type Streamable<
  C extends Messages = Messages,
  E extends Messages = Messages
> = Artifact<C, E> & {
  stream: () => string;
};

/**
 * Reducible artifacts reduce state from event streams
 */
export type Reducible<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = Streamable<C, E> & {
  schemas: {
    state: ZodType<S>;
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
> = Reducible<S, C, E> & {
  on: { [K in keyof C & string]: CommandHandler<S, C, E, K> };
};

/**
 * Systems handle commands and produce events without internal state
 */
export type System<
  C extends Messages = Messages,
  E extends Messages = Messages
> = Streamable<C, E> & {
  on: { [K in keyof C & string]: CommandHandler<State, C, E, K> };
};

/**
 * Policies handle committed events and optionally produce commands
 */
export type Policy<
  C extends Messages = Messages,
  E extends Messages = Messages
> = Artifact<C, E> & {
  on: {
    [K in keyof E & string]: EventHandler<State, C, E, K>;
  };
};

/**
 * Process managers handle events and optionally produce commands
 * - Have reducible state, allowing to expand the consistency boundaries of multiple events into a local state machine
 */
export type ProcessManager<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = Reducible<S, C, E> & {
  on: {
    [K in keyof E & string]: EventHandler<S, C, E, K>;
  };
};

/**
 * Command adapters convert messages to commands
 * - This is a "Policy" with a generic input not following the committed event schema
 */
export type CommandAdapter<
  S extends State = State,
  C extends Messages = Messages
> = {
  description: string;
  adapt: (payload: Readonly<S>) => Command<C>;
  schema: ZodType<S>;
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
