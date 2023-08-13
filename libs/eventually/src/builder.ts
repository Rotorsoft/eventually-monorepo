import EventEmitter from "node:events";
import type { Disposable, ProjectorStore } from "./interfaces";
import type {
  Artifact,
  ArtifactFactory,
  ArtifactType,
  Messages,
  Projection,
  ProjectionResults,
  ProjectionSort,
  ProjectorFactory,
  ReducibleFactory,
  Schema,
  Scope,
  Snapshot,
  State
} from "./types";
import type { ZodType } from "zod";

/**
 * Internal message details used as main drivers of public interfaces and documentation
 */
export type MessageMetadata<M extends Messages = Messages> = {
  name: keyof M;
  schema: ZodType<M[keyof M]>;
  type: "command" | "event" | "message";
  handlers: string[];
  producer?: string;
};

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
  projector?: {
    schema: Schema<Projection<S>>;
    store: ProjectorStore<S>;
    indexes: ProjectionSort<S>[];
  };
};

/**
 * Returns true to commit state in stream
 * @param snapshot - current snapshot
 */
export type CommitPredicate<
  S extends State = State,
  E extends Messages = Messages
> = (snapshot: Snapshot<S, E>) => boolean;

/**
 * Registration options
 * - `scope?` the scope used to publish message handlers
 * - `store?` a projector store associated with projectors
 * - `commit?` flags when to store state snapshots in the aggregate stream
 */
export type WithOptions<S extends State, E extends Messages> = {
  scope?: Scope;
  projector?: { store: ProjectorStore<S>; indexes: ProjectionSort<S>[] };
  commit?: CommitPredicate<S, E>;
};

export declare interface Builder {
  on(
    event: "commit",
    listener: (args: { factory: ReducibleFactory; snapshot?: Snapshot }) => void
  ): this;
  on(
    event: "projection",
    listener: (args: {
      factory: ProjectorFactory;
      results: ProjectionResults;
    }) => void
  ): this;
}

/**
 * Abstract application builder
 *
 * Concrete adapters should provide disposers and the listening framework
 */
export abstract class Builder extends EventEmitter implements Disposable {
  abstract readonly name: string;
  abstract listen(): Promise<void>;

  dispose(): Promise<void> {
    this.removeAllListeners();
    return Promise.resolve();
  }

  private _hasStreams = false;
  readonly messages = new Map<string, MessageMetadata>();
  readonly artifacts = new Map<string, ArtifactMetadata>();
  readonly commits = new Map<string, CommitPredicate>();

  constructor() {
    super();
  }

  private _reflect = (
    factory: ArtifactFactory,
    scope: Scope
  ): ArtifactMetadata => {
    const artifact = factory("") as Artifact;

    "stream" in artifact && this.withStreams();
    const reducible = "reduce" in artifact;

    "events" in artifact.schemas &&
      Object.entries(artifact.schemas.events).forEach(([name, schema]) => {
        !this.messages.has(name) &&
          this.messages.set(name, {
            name,
            schema,
            type: "event",
            handlers: []
          });
      });

    if ("on" in artifact) {
      if ("commands" in artifact.schemas) {
        if (typeof artifact.on === "function") {
          "message" in artifact.schemas &&
            this.messages.set(factory.name, {
              name: factory.name,
              schema: artifact.schemas.message,
              type: "message",
              handlers: [factory.name]
            });
          return {
            type: "command-adapter",
            factory,
            inputs: [{ name: factory.name, scope }],
            outputs: Object.keys(artifact.schemas.commands)
          };
        }
        if (artifact.on[Object.keys(artifact.schemas.commands).at(0) || ""]) {
          const schemas = artifact.schemas.commands as Record<string, ZodType>;
          const inputs = Object.keys(artifact.on);
          inputs.forEach((name) => {
            // enforce one command handler per command
            const found = this.messages.get(name);
            if (found)
              throw Error(
                `Duplicate command "${name}" found in "${found.handlers[0]}" and "${factory.name}"`
              );
            this.messages.set(name, {
              name,
              schema: schemas[name],
              type: "command",
              handlers: [factory.name]
            });
          });
          return {
            type: reducible ? "aggregate" : "system",
            factory,
            inputs: inputs.map((name) => ({ name, scope })),
            outputs:
              "events" in artifact.schemas
                ? Object.keys(artifact.schemas.events)
                : []
          };
        }
      }
      if ("events" in artifact.schemas) {
        const inputs = Object.keys(artifact.on);
        inputs.forEach((name) => {
          this.messages.get(name)?.handlers.push(factory.name); // compile event handlers
        });
        return {
          type: reducible
            ? "process-manager"
            : "commands" in artifact.schemas
            ? "policy"
            : "projector",
          factory,
          inputs: inputs.map((name) => ({ name, scope })),
          outputs:
            "commands" in artifact.schemas
              ? Object.keys(artifact.schemas.commands)
              : []
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
   * @param factory the artifact factory
   * @param options the artifact options
   */
  with<
    S extends State,
    C extends Messages,
    E extends Messages,
    O extends Messages
  >(factory: ArtifactFactory<S, C, E, O>, options?: WithOptions<S, E>): this {
    if (this.artifacts.has(factory.name))
      throw Error(`Duplicate artifact "${factory.name}"`);
    const metadata = this._reflect(
      factory as ArtifactFactory,
      options?.scope || "default"
    );
    this.artifacts.set(factory.name, metadata);
    if (options) {
      options.commit &&
        this.commits.set(factory.name, options.commit as CommitPredicate);
      if (metadata.type === "projector" && options.projector) {
        const artifact = factory("");
        const schema =
          "state" in artifact.schemas
            ? (artifact.schemas.state as Schema<Projection<S>>)
            : undefined;
        if (schema) {
          const am = metadata as ArtifactMetadata<S, C, E>;
          am.projector = { ...options.projector, schema };
        }
      }
    }
    return this;
  }

  /**
   * Builds message handlers
   * Concrete app adapters should provide their own building steps
   * @returns optional internal application object (e.g. express)
   */
  build(): unknown | undefined {
    // set producers
    this.artifacts.forEach((md) => {
      md.outputs
        .map((msg) => this.messages.get(msg))
        .filter(Boolean)
        .forEach((msg) => msg && (msg.producer = md.factory.name));
    });
    // scope default endpoints
    this.artifacts.forEach((md) => {
      md.inputs
        .filter((input) => input.scope === "default")
        .forEach((input) => {
          input.scope =
            md.type === "command-adapter" ||
            !this.messages.get(input.name)?.producer
              ? "public"
              : "private";
        });
    });
    return;
  }
}
