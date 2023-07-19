import {
  Aggregate,
  ArtifactType,
  CommandAdapter,
  Policy,
  ProcessManager,
  Projector,
  System
} from "./artifacts";
import { Scope } from "./enums";
import { Messages, State } from "./messages";

/**
 * Aggregate factories build aggregates
 */
export type AggregateFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = (stream: string) => Aggregate<S, C, E>;

/**
 * System factories build systems
 */
export type SystemFactory<
  C extends Messages = Messages,
  E extends Messages = Messages
> = () => System<C, E>;

/**
 * Policy factories build policies
 */
export type PolicyFactory<
  C extends Messages = Messages,
  E extends Messages = Messages
> = () => Policy<C, E>;

/**
 * Process manager factories build process managers
 */
export type ProcessManagerFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages,
  O extends Messages = Messages
> = () => ProcessManager<S, C, E, O>;

/**
 * Projector factories build projectors
 */
export type ProjectorFactory<
  S extends State = State,
  E extends Messages = Messages
> = () => Projector<S, E>;

/**
 * Command adapter factories build command adapters
 */
export type CommandAdapterFactory<
  P extends State = State,
  C extends Messages = Messages
> = () => CommandAdapter<P, C>;

/**
 * All streamable factories
 */
export type StreamableFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = AggregateFactory<S, C, E> | SystemFactory<C, E>;

/**
 * All reducible factories
 */
export type ReducibleFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages,
  O extends Messages = Messages
> = AggregateFactory<S, C, E> | ProcessManagerFactory<S, C, E, O>;

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
  E extends Messages = Messages,
  O extends Messages = Messages
> =
  | ProcessManagerFactory<S, C, E, O>
  | PolicyFactory<C, E>
  | ProjectorFactory<S, E>;

/**
 * All message handler factories
 */
export type ArtifactFactory<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages,
  O extends Messages = Messages
> =
  | CommandHandlerFactory<S, C, E>
  | EventHandlerFactory<S, C, E, O>
  | CommandAdapterFactory<S, C>;

/**
 * Artifact reflected metadata
 */
export type ArtifactMetadata<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = {
  type: ArtifactType;
  factory: ArtifactFactory<S, C, E>;
  inputs: Array<{ name: string; scope: Scope }>; // input messages = endpoints
  outputs: string[]; // output messages = side effects
};
