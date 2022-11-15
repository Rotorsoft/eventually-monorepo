import { config } from "./config";
import {
  CommandHandlerType,
  Endpoints,
  EventHandlerType,
  Factories,
  SnapshotOptions
} from "./types/app";
import {
  AggregateFactory,
  CommandAdapterFactory,
  CommandHandlerFactory,
  EventHandlerFactory,
  ExternalSystemFactory,
  PolicyFactory,
  ProcessManagerFactory,
  Reducible,
  Snapshot
} from "./types/command-side";
import { Messages, Payload } from "./types/messages";
import { MessageMetadata, Schemas, WithSchemas } from "./types/schemas";
import {
  commandHandlerPath,
  eventHandlerPath,
  eventsOf,
  getReducible,
  messagesOf
} from "./utils";

export class Builder {
  protected readonly _snapshotOptions: Record<string, SnapshotOptions> = {};
  protected readonly _factories: Factories = {
    commandHandlers: {},
    eventHandlers: {},
    commandAdapters: {}
  };
  readonly endpoints: Endpoints = {
    version: "",
    commandHandlers: {},
    eventHandlers: {}
  };
  readonly messages: Record<string, MessageMetadata> = {};
  readonly documentation: Record<string, { description: string }> = {};
  private _hasStreams = false;
  get hasStreams(): boolean {
    return this._hasStreams;
  }

  private _msg<T extends Messages>(name: keyof T & string): MessageMetadata<T> {
    return (this.messages[name] = this.messages[name] || {
      name,
      eventHandlerFactories: {}
    });
  }

  private _registerSchemas<C extends Messages, E extends Messages>(
    handler: WithSchemas<C, E>
  ): void {
    handler.schemas &&
      Object.entries(handler.schemas).map(([key, value]): void => {
        this._msg(key).schema = value;
      });
  }

  private _registerEventHandlerFactory<
    M extends Payload,
    C extends Messages,
    E extends Messages
  >(factory: EventHandlerFactory<M, C, E>, description = ""): void {
    if (this._factories.eventHandlers[factory.name])
      throw Error(`Duplicate event handler ${factory.name}`);
    this._factories.eventHandlers[factory.name] =
      factory as EventHandlerFactory<Payload, any, any>;
    this.documentation[factory.name] = { description };
    this._registerSchemas(factory(""));
  }

  private _registerCommandHandlerFactory<
    M extends Payload,
    C extends Messages,
    E extends Messages
  >(factory: CommandHandlerFactory<M, C, E>, description = ""): void {
    if (this._factories.commandHandlers[factory.name])
      throw Error(`Duplicate command handler ${factory.name}`);
    this._factories.commandHandlers[factory.name] =
      factory as CommandHandlerFactory<Payload, any, any>;
    this.documentation[factory.name] = { description };
    this._registerSchemas(factory(""));
  }

  /**
   * Flags app with streams
   */
  withStreams(): this {
    this._hasStreams = true;
    return this;
  }

  /**
   * Registers message schemas
   * @param schemas Message validation schemas
   */
  withSchemas<M extends Messages>(schemas: Schemas<M>): this {
    Object.entries(schemas).map(([key, value]): void => {
      this._msg(key).schema = value as any;
    });
    return this;
  }

  /**
   * Registers policy factory
   * @param factory the factory
   * @param description describes the factory
   */
  withPolicy<C extends Messages, E extends Messages>(
    factory: PolicyFactory<C, E>,
    description?: string
  ): this {
    this._registerEventHandlerFactory(factory, description);
    return this;
  }

  /**
   * Registers process manager factory
   * @param factory the factory
   * @param description describes the factory
   */
  withProcessManager<M extends Payload, C extends Messages, E extends Messages>(
    factory: ProcessManagerFactory<M, C, E>,
    description?: string
  ): this {
    this._registerEventHandlerFactory(factory, description);
    return this;
  }

  /**
   * Registers command adapters
   * @param factory command adapter factory
   */
  withCommandAdapter<P extends Payload, C extends Messages>(
    factory: CommandAdapterFactory<P, C>
  ): this {
    this._factories.commandAdapters[factory.name] =
      factory as CommandAdapterFactory<Payload, any>;
    this._msg(factory.name).schema = factory().schema;
    return this;
  }

  /**
   * Registers aggregate factory
   * @param factory the factory
   * @param description describes the factory
   * @param snapshotOptions optional snapshotting options
   */
  withAggregate<M extends Payload, C extends Messages, E extends Messages>(
    factory: AggregateFactory<M, C, E>,
    description?: string,
    snapshotOptions?: SnapshotOptions
  ): this {
    snapshotOptions && (this._snapshotOptions[factory.name] = snapshotOptions);
    this._registerCommandHandlerFactory(factory, description);
    return this;
  }

  /**
   * Registers system factory
   * @param factory the factory
   * @param description describes the factory
   */
  withExternalSystem<C extends Messages, E extends Messages>(
    factory: ExternalSystemFactory<C, E>,
    description?: string
  ): this {
    this._registerCommandHandlerFactory(factory, description);
    return this;
  }

  /**
   * Reads snapshot from store when configured with options
   * @param reducible The reducible artifact
   * @returns The snapshot
   */
  async readSnapshot<M extends Payload, E extends Messages>(
    reducible: Reducible<M, E>
  ): Promise<Snapshot<M, E> | undefined> {
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
  async writeSnapshot<M extends Payload, E extends Messages>(
    reducible: Reducible<M, E>,
    snapshot: Snapshot<M, E>,
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
   * Builds message handlers and private subscriptions
   * Concrete app implementations should deal with their own building steps
   * @returns optional internal application object (e.g. express)
   */
  build(): unknown | undefined {
    this.endpoints.version = config().version;
    // command handlers
    Object.values(this._factories.commandHandlers).forEach((factory) => {
      const handler = factory("");
      const reducible = getReducible(handler);
      const type: CommandHandlerType = reducible
        ? "aggregate"
        : "external-system";
      const events =
        (reducible &&
          eventsOf(reducible).map((name) => {
            this._msg(name);
            return name;
          })) ||
        [];
      const endpoint = (this.endpoints.commandHandlers[factory.name] = {
        type,
        factory,
        commands: {} as Record<string, string>,
        events
      });
      messagesOf(handler).map((name) => {
        const msg = this._msg(name);
        msg.commandHandlerFactory = factory;
        endpoint.commands[name] = commandHandlerPath(factory, name);
      });
      this.withStreams();
    });

    // event handlers
    Object.values(this._factories.eventHandlers).forEach((factory) => {
      const handler = factory("");
      const reducible = getReducible(handler);
      const type: EventHandlerType = reducible ? "process-manager" : "policy";
      const path = eventHandlerPath(factory);
      const events = messagesOf(handler).map((name) => {
        const msg = this._msg(name);
        msg.eventHandlerFactories[path] = factory;
        return name;
      });
      this.endpoints.eventHandlers[factory.name] = {
        type,
        factory,
        path,
        events
      };
      reducible && this.withStreams();
    });

    return;
  }
}
