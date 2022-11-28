import { ZodType } from "zod";
import { config } from "./config";
import { SnapshotStore } from "./interfaces";
import {
  AggregateFactory,
  ArtifactMetadata,
  MessageHandlerFactory,
  MessageHandlingArtifact,
  Messages,
  Reducible,
  Snapshot,
  State
} from "./types";

type MessageMetadata<M extends Messages = Messages> = {
  name: keyof M & string;
  schema: ZodType<M[keyof M]>;
  type: "command" | "event" | "message";
  handlers: string[];
};

type SnapshotOptions = {
  store: SnapshotStore;
  threshold: number;
  expose?: boolean;
};

export class Builder {
  private _hasStreams = false;
  protected _snapshotOptions: Record<string, SnapshotOptions> = {};

  readonly version = config().version;
  readonly messages: Record<string, MessageMetadata> = {};
  readonly artifacts: Record<string, ArtifactMetadata> = {};

  private _reflect = (factory: MessageHandlerFactory): ArtifactMetadata => {
    const artifact = factory("") as MessageHandlingArtifact;
    if ("on" in artifact) {
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

      if (
        "commands" in artifact.schemas &&
        artifact.on[Object.keys(artifact.schemas.commands).at(0) || ""]
      ) {
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

      if ("events" in artifact.schemas) {
        Object.keys(artifact.on).forEach((name) => {
          this.messages[name].handlers.push(factory.name); // compile event handlers
        });
        return {
          type: reducible ? "process-manager" : "policy",
          factory,
          inputs: Object.keys(artifact.on),
          outputs: Object.keys(artifact.schemas.commands)
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
    factory: MessageHandlerFactory<S, C, E>
  ): this {
    if (this.artifacts[factory.name])
      throw Error(`Duplicate artifact "${factory.name}"`);
    this.artifacts[factory.name] = this._reflect(
      factory as MessageHandlerFactory
    );
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
    this._snapshotOptions[factory.name] = snapshotOptions;
    return this;
  }

  /**
   * Reads snapshot from store when configured with options
   * @param reducible The reducible artifact
   * @returns The snapshot
   */
  async readSnapshot<S extends State, E extends Messages>(
    reducible: Reducible<S, E>
  ): Promise<Snapshot<S, E> | undefined> {
    const { name } = Object.getPrototypeOf(reducible);
    const snap = this._snapshotOptions[name];
    return snap && (await snap.store.read(reducible.stream()));
  }

  /**
   * Writes snapshot to store when configured with options
   * @param reducible The reducible artifact
   * @param snapshot The snapshot
   * @param applyCount The number of events applied after last snapshot
   */
  async writeSnapshot<S extends State, E extends Messages>(
    reducible: Reducible<S, E>,
    snapshot: Snapshot<S, E>,
    applyCount: number
  ): Promise<void> {
    try {
      const { name } = Object.getPrototypeOf(reducible);
      const snap = this._snapshotOptions[name];
      snap &&
        applyCount > snap.threshold &&
        (await snap.store.upsert(reducible.stream(), snapshot));
    } catch {
      // fail quietly for now
      // TODO: monitor failures to recover
    }
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
