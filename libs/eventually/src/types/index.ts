import { ArtifactType } from "./artifacts";
import { MessageHandlerFactory } from "./factories";
import { Messages, State } from "./messages";

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

export * from "./artifacts";
export * from "./client";
export * from "./enums";
export * from "./errors";
export * from "./factories";
export * from "./messages";
