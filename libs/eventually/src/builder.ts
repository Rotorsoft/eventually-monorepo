import { ZodType } from "zod";
import { Disposable, SnapshotStore } from "./interfaces";
import {
  AggregateFactory,
  Artifact,
  ArtifactFactory,
  ArtifactMetadata,
  Messages,
  State
} from "./types";

type MessageMetadata<M extends Messages = Messages> = {
  name: keyof M;
  schema: ZodType<M[keyof M]>;
  type: "command" | "event" | "message";
  handlers: string[];
};

type SnapshotOptions = {
  store: SnapshotStore;
  threshold: number;
  expose?: boolean;
};

export abstract class Builder implements Disposable {
  /**
   * Concrete adapters should provide disposers and the listening framework
   */
  abstract readonly name: string;
  abstract dispose(): Promise<void>;
  abstract listen(): Promise<void>;

  private _hasStreams = false;
  readonly version;
  readonly snapOpts: Record<string, SnapshotOptions> = {};
  readonly messages: Record<string, MessageMetadata> = {};
  readonly artifacts: Record<string, ArtifactMetadata> = {};

  constructor(version: string) {
    this.version = version;
  }

  private _reflect = (factory: ArtifactFactory): ArtifactMetadata => {
    const artifact = factory("") as Artifact;

    "stream" in artifact && this.withStreams();
    const reducible = "reduce" in artifact;

    "events" in artifact.schemas &&
      Object.entries(artifact.schemas.events).forEach(([name, schema]) => {
        this.messages[name] = this.messages[name] || {
          name,
          schema,
          type: "event",
          handlers: []
        };
      });

    if ("on" in artifact) {
      if ("commands" in artifact.schemas) {
        if (typeof artifact.on === "function") {
          "message" in artifact.schemas &&
            (this.messages[factory.name] = {
              name: factory.name,
              schema: artifact.schemas.message,
              type: "message",
              handlers: [factory.name]
            });
          return {
            type: "command-adapter",
            factory,
            inputs: [factory.name],
            outputs: Object.keys(artifact.schemas.commands)
          };
        }
        if (artifact.on[Object.keys(artifact.schemas.commands).at(0) || ""]) {
          const schemas = artifact.schemas.commands as Record<string, ZodType>;
          Object.keys(artifact.on).forEach((name) => {
            // enforce one command handler per command
            if (this.messages[name])
              throw Error(
                `Duplicate command "${name}" found in "${this.messages[name].handlers[0]}" and "${factory.name}"`
              );
            this.messages[name] = {
              name,
              schema: schemas[name],
              type: "command",
              handlers: [factory.name]
            };
          });
          return {
            type: reducible ? "aggregate" : "system",
            factory,
            inputs: Object.keys(artifact.on),
            outputs: reducible ? Object.keys(artifact.reduce) : []
          };
        }
      }
      if ("events" in artifact.schemas) {
        Object.keys(artifact.on).forEach((name) => {
          this.messages[name].handlers.push(factory.name); // compile event handlers
        });
        const inputs = Object.keys(artifact.on);
        const outputs =
          "commands" in artifact.schemas
            ? Object.keys(artifact.schemas.commands)
            : [];
        return {
          type: reducible
            ? "process-manager"
            : "init" in artifact
            ? "projector"
            : "policy",
          factory,
          inputs,
          outputs
        };
      }
    }
    // oops
    throw Error(
      `Invalid artifact "${factory.name}". This should never happen!`
    );
  };

  /**
   * Flags app with streams
   */
  withStreams(): this {
    this._hasStreams = true;
    return this;
  }

  get hasStreams(): boolean {
    return this._hasStreams;
  }

  /**
   * Registers factory
   * @param factory the factory
   */
  with<S extends State, C extends Messages, E extends Messages>(
    factory: ArtifactFactory<S, C, E>
  ): this {
    if (this.artifacts[factory.name])
      throw Error(`Duplicate artifact "${factory.name}"`);
    this.artifacts[factory.name] = this._reflect(factory as ArtifactFactory);
    return this;
  }

  /**
   * Registers aggregate snapshot options
   * @param factory the factory
   * @param snapshotOptions snapshot options
   */
  withSnapshot<S extends State, C extends Messages, E extends Messages>(
    factory: AggregateFactory<S, C, E>,
    snapshotOptions: SnapshotOptions
  ): this {
    this.snapOpts[factory.name] = snapshotOptions;
    return this;
  }

  /**
   * Builds message handlers
   * Concrete app adapters should provide their own building steps
   * @returns optional internal application object (e.g. express)
   */
  build(): unknown | undefined {
    return;
  }
}
