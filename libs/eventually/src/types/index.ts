import { ArtifactType } from "./artifacts";
import { MessageHandlerFactory, ReducibleFactory } from "./factories";
import { Messages, Snapshot, State } from "./messages";

/**
 * Artifact reflected metadata
 */
export type ArtifactMetadata<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = {
  type: ArtifactType;
  factory: MessageHandlerFactory<S, C, E>;
  inputs: string[]; // input message names - endpoints
  outputs: string[]; // output message names - side effects
};

/**
 * Reducers handle reducibles and produce snapshots
 */
export type Reducer<
  S extends State = State,
  C extends Messages = Messages,
  E extends Messages = Messages
> = (
  factory: ReducibleFactory<S, C, E>,
  id: string,
  useSnapshot?: boolean,
  callback?: (snapshot: Snapshot<S, E>) => void
) => Promise<Snapshot<S, E> | Snapshot<S, E>[]>;

export * from "./artifacts";
export * from "./enums";
export * from "./errors";
export * from "./factories";
export * from "./messages";
