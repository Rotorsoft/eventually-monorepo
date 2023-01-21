import { ZodType } from "zod";
import { Disposable, ProjectorStore, SnapshotStore } from "./interfaces";
import {
  AggregateFactory,
  Artifact,
  ArtifactFactory,
  ArtifactMetadata,
  Messages,
  ProjectorFactory,
  State
} from "./types";

type MessageMetadata<M extends Messages = Messages> = {
  name: keyof M;
  schema: ZodType<M[keyof M]>;
  type: "command" | "event" | "message";
  handlers: string[];
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
  readonly messages: Record<string, MessageMetadata> = {};
  readonly artifacts: Record<string, ArtifactMetadata> = {};
  readonly stores: Record<string, ProjectorStore | SnapshotStore> = {};

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
            : "load" in artifact
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
   * Registers artifact stores
   * @param factory the factory
   * @param store the store
   */
  withStore<S extends State, C extends Messages, E extends Messages>(
    factory:
      | AggregateFactory<S, C, E>
      | ProjectorFactory<S & { id: string }, E>,
    store: SnapshotStore | ProjectorStore
  ): this {
    const metadata = this.artifacts[factory.name];
    if (!metadata)
      throw Error(`Factory ${factory.name} must be registered before store.`);
    if (
      !(
        (metadata.type === "aggregate" &&
          "read" in store &&
          "upsert" in store &&
          "query" in store) ||
        (metadata.type === "projector" && "load" in store && "commit" in store)
      )
    )
      throw Error(`Invalid store ${store.name} for ${factory.name}.`);
    this.stores[factory.name] = store;
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
