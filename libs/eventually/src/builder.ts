import { ZodType } from "zod";
import { Disposable, ProjectorStore, SnapshotStore } from "./interfaces";
import {
  AggregateFactory,
  Artifact,
  ArtifactFactory,
  ArtifactMetadata,
  Messages,
  ProjectorFactory,
  Scope,
  Snapshot,
  State
} from "./types";

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
 * Returns true to commit state in stream
 * @param snapshot - current snapshot
 */
export type CommitPredicate<
  S extends State = State,
  E extends Messages = Messages
> = (snapshot: Snapshot<S, E>) => boolean;

/**
 * Registration options
 * - `scope` the scope
 * - `commit?` the commit predicate
 */
export type WithOptions = {
  scope: Scope;
  commit?: CommitPredicate;
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
  readonly commits: Record<string, CommitPredicate> = {};

  constructor(version: string) {
    this.version = version;
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
            inputs: [{ name: factory.name, scope }],
            outputs: Object.keys(artifact.schemas.commands)
          };
        }
        if (artifact.on[Object.keys(artifact.schemas.commands).at(0) || ""]) {
          const schemas = artifact.schemas.commands as Record<string, ZodType>;
          const inputs = Object.keys(artifact.on);
          inputs.forEach((name) => {
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
          this.messages[name].handlers.push(factory.name); // compile event handlers
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
   * @param factory the factory
   * @param options the options
   */
  with<S extends State, C extends Messages, E extends Messages>(
    factory: ArtifactFactory<S, C, E>,
    options: WithOptions = { scope: Scope.default }
  ): this {
    if (this.artifacts[factory.name])
      throw Error(`Duplicate artifact "${factory.name}"`);
    this.artifacts[factory.name] = this._reflect(
      factory as ArtifactFactory,
      options.scope
    );
    options.commit && (this.commits[factory.name] = options.commit);
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
          "upsert" in store) ||
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
    // set producers
    Object.values(this.artifacts).forEach((md) => {
      md.outputs
        .map((msg) => this.messages[msg])
        .filter(Boolean)
        .forEach((msg) => (msg.producer = md.factory.name));
    });
    // scope default endpoints
    Object.values(this.artifacts).forEach((md) => {
      md.inputs
        .filter((input) => input.scope === Scope.default)
        .forEach((input) => {
          input.scope =
            process.env.NODE_ENV === "test" || // force public when testing
            md.type === "command-adapter" ||
            !this.messages[input.name].producer
              ? Scope.public
              : Scope.private;
        });
    });
    return;
  }
}
