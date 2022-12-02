import {
  Aggregate,
  CommandAdapter,
  Policy,
  ProcessManager,
  System
} from "./artifacts";
import { CommittedEvent, Messages, State } from "./messages";

/**
 * Aggregate factories build aggregates
 */
export type AggregateFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = (id: string) => Aggregate<S, C, E>;

/**
 * System factories build systems
 */
export type SystemFactory<
  C extends Messages,
  E extends Messages
> = () => System<C, E>;

/**
 * Policy factories build policies
 */
export type PolicyFactory<
  C extends Messages,
  E extends Messages
> = () => Policy<C, E>;

/**
 * Process manager factories build process managers
 */
export type ProcessManagerFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = (eventOrId: CommittedEvent<E> | string) => ProcessManager<S, C, E>;

/**
 * Command adapter factories build command adapters
 */
export type CommandAdapterFactory<
  P extends State = State,
  C extends Messages = Messages
> = () => CommandAdapter<P, C>;

/**
 * All reducible factories
 */
export type ReducibleFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = AggregateFactory<S, C, E> | ProcessManagerFactory<S, C, E>;

/**
 * All command handler factories
 */
export type CommandHandlerFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = AggregateFactory<S, C, E> | SystemFactory<C, E>;

/**
 * All event handler factories
 */
export type EventHandlerFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = ProcessManagerFactory<S, C, E> | PolicyFactory<C, E>;

/**
 * All message handler factories
 */
export type MessageHandlerFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> =
  | CommandHandlerFactory<S, C, E>
  | EventHandlerFactory<S, C, E>
  | CommandAdapterFactory<S, C>;
