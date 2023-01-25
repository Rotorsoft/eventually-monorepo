import { ArtifactType } from "./artifacts";
import { ArtifactFactory } from "./factories";
import { Messages, State } from "./messages";

/**
 * Artifact registration scopes
 * - `public` input handlers are public (as HTTP endpoints)
 * - `private` input handlers are only avilable within the service via client() ports
 * - `default` command handlers are public, event handlers are private when event producers are found within the service, otherwise public
 */
export enum Scope {
  public = "public",
  private = "private",
  default = "default"
}

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

export * from "./artifacts";
export * from "./client";
export * from "./enums";
export * from "./errors";
export * from "./factories";
export * from "./messages";
