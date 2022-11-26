import {
  Actor,
  Command,
  CommittedEvent,
  Message,
  Messages,
  State
} from "./messages";

/**
 * Event reducers apply events to state
 */
export type EventReducer<
  S extends State,
  E extends Messages,
  K extends keyof E & string
> = (state: Readonly<S>, event: CommittedEvent<Pick<E, K>>) => Readonly<S>;

/**
 * Command handlers handle commands with optional state and emit events
 */
export type CommandHandler<
  S extends State,
  C extends Messages,
  E extends Messages,
  K extends keyof C & string
> = (
  payload: Readonly<C[K]>,
  state: Readonly<S>,
  actor?: Actor
) => Promise<Message<E>[]>;

/**
 * Event handlers handle events with optional state and optionally produce a command
 * targetting an aggregate
 */
export type EventHandler<
  S extends State,
  C extends Messages,
  E extends Messages,
  K extends keyof E & string
> = (
  event: CommittedEvent<Pick<E, K>>,
  state: Readonly<S>
) => Promise<Command<C> | undefined> | undefined;
