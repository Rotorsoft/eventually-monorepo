import {
  Aggregate,
  AggregateFactory,
  ExternalSystem,
  ExternalSystemFactory,
  Policy,
  PolicyFactory,
  ProcessManager,
  ProcessManagerFactory,
  Reducible,
  Snapshot
} from "./command";
import { Payload } from "./message";
import { Projector, ProjectorFactory } from "./query";

export * from "./generic";
export * from "./message";
export * from "./command";
export * from "./query";

/**
 * All message handler factory types
 */
export type MessageHandlerFactory<M extends Payload, C, E> =
  | AggregateFactory<M, C, E>
  | ExternalSystemFactory<C, E>
  | ProcessManagerFactory<M, C, E>
  | PolicyFactory<C, E>;

export type ReducibleFactory<M extends Payload, C, E> =
  | AggregateFactory<M, C, E>
  | ProcessManagerFactory<M, C, E>;

export type CommandHandlerFactory<M extends Payload, C, E> =
  | AggregateFactory<M, C, E>
  | ExternalSystemFactory<C, E>;

export type EventHandlerFactory<M extends Payload, C, E> =
  | ProcessManagerFactory<M, C, E>
  | PolicyFactory<C, E>
  | ProjectorFactory<M, E>;

export type CommandHandler<M extends Payload, C, E> =
  | Aggregate<M, C, E>
  | ExternalSystem<C, E>;

export type EventHandler<M extends Payload, C, E> =
  | ProcessManager<M, C, E>
  | Policy<C, E>
  | Projector<M, E>;

/**
 * All message handler types
 */
export type MessageHandler<M extends Payload, C, E> =
  | Aggregate<M, C, E>
  | ExternalSystem<C, E>
  | ProcessManager<M, C, E>
  | Policy<C, E>
  | Projector<M, E>;

/**
 * Apps are getters of reducibles
 */
export type Getter = <M extends Payload, E>(
  reducible: Reducible<M, E>,
  useSnapshot?: boolean,
  callback?: (snapshot: Snapshot<M>) => void
) => Promise<Snapshot<M> | Snapshot<M>[]>;
