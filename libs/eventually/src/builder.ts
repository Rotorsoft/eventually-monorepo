import { ZodType } from "zod";
import { config } from "./config";
import { SnapshotStore } from "./interfaces";
import { MessageHandlingArtifact, Reducible } from "./types/artifacts";
import { ArtifactType } from "./types/enums";
import {
  AggregateFactory,
  ArtifactMetadata,
  MessageHandlerFactory
} from "./types/factories";
import { Messages, Snapshot, State } from "./types/messages";
import { commandHandlerPath, eventHandlerPath } from "./utils";

type MessageMetadata<M extends Messages = Messages> = {
  name: keyof M & string;
  schema: ZodType<M[keyof M]>;
  type: "command" | "event";
  artifacts: string[];
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

  private _reflect = (
    factory: MessageHandlerFactory
  ): [ArtifactType, Record<string, string>[], string[]] => {
    const artifact = factory("") as MessageHandlingArtifact;
    "stream" in artifact && this.withStreams();
    if ("on" in artifact) {
      const reducible = "reduce" in artifact;

      // all event messages
      Object.entries(artifact.schemas.events).forEach(([name, schema]) => {
        this.messages[name] = this.messages[name] || {
          name,
          schema,
          type: "event",
          artifacts: []
        };
      });

      // command handling artifacts with their command messages
      const command = Object.keys(artifact.schemas.commands).at(0);
      if (command && artifact.on[command]) {
        const input = Object.keys(artifact.on).map((name) => {
          this.messages[name] = this.messages[name] || {
            name,
            schema: artifact.schemas.commands[name],
            type: "command",
            artifacts: [factory.name] // one command handler
          };
          return { [name]: commandHandlerPath(factory.name, reducible, name) };
        });
        const output = reducible ? Object.keys(artifact.reduce) : []; // output is reduced
        return [reducible ? "aggregate" : "system", input, output];
      }

      // event handling artifacts
      const event = Object.keys(artifact.schemas.events).at(0);
      if (event && artifact.on[event]) {
        const input = Object.keys(artifact.on).map((name) => {
          this.messages[name].artifacts.push(factory.name); // many event handlers
          return {
            [name]: eventHandlerPath(factory.name)
          };
        });
        const output = Object.keys(artifact.schemas.commands); // output commands
        return [reducible ? "process-manager" : "policy", input, output];
      }
    } else if ("adapt" in artifact) return ["command-adapter", [], []];

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

    const [type, input, output] = this._reflect(
      factory as MessageHandlerFactory
    );
    this.artifacts[factory.name] = {
      type,
      factory: factory as MessageHandlerFactory,
      input: input.reduce((p, c) => Object.assign(p, c), {}),
      output
    };
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
  async readSnapshot<S extends State, C extends Messages, E extends Messages>(
    reducible: Reducible<S, C, E>
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
  async writeSnapshot<S extends State, C extends Messages, E extends Messages>(
    reducible: Reducible<S, C, E>,
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
