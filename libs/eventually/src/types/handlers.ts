import {
  Actor,
  Command,
  CommittedEvent,
  Message,
  Messages,
  State
} from "./messages";

/**
 * Event reducers apply events to a reduced state, resulting in a new state
 * - `state` the current reduced state
 * - `event` the event to be applied
 */
export type EventReducer<
  S extends State,
  E extends Messages,
  K extends keyof E
> = (
  state: Readonly<S>,
  event: CommittedEvent<Pick<E, K>>
) => Readonly<Partial<S>>;

/**
 * Command handlers handle commands and emit events
 * - `data` the command's payload
 * - `state` the state of the artifact handling this command - Empty for systems
 * - `actor?` the actor invoking the command
 */
export type CommandHandler<
  S extends State,
  C extends Messages,
  E extends Messages,
  K extends keyof C
> = (
  data: Readonly<C[K]>,
  state: Readonly<S>,
  actor?: Actor
) => Promise<Message<E>[]>;

/**
 * Invariants validate aggregate preconditions before processing commands,
 * allowing state and authorization checks in a declarative way
 */
export type Invariant<S extends State> = {
  description: string;
  valid: (state: Readonly<S>, actor?: Actor) => boolean;
};

/**
 * Event handlers handle events and can produce a command targetting a command handler
 * - `event` the committed event being handled
 * - `state` the state of the artifact handling this event - only applies to process managers, Empty for policies
 */
export type EventHandler<
  S extends State,
  C extends Messages,
  E extends Messages,
  K extends keyof E
> = (
  event: CommittedEvent<Pick<E, K>>,
  state: Readonly<S>
) => Promise<Command<C> | undefined> | undefined;

/**
 * Actor handlers extract process manager actor ids from input events
 * - `event` the committed event being handled
 */
export type ActorHandler<E extends Messages, K extends keyof E> = (
  event: CommittedEvent<Pick<E, K>>
) => string;
