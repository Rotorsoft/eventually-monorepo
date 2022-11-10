import { config } from "./config";
import {
  CommandHandlerType,
  Endpoints,
  EventHandlerType,
  Factories,
  MessageMetadata,
  Schemas,
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
  Snapshot,
  WithSchemas
} from "./types/command-side";
import { Messages, Payload } from "./types/messages";
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
    eventHandlers: {},
    schemas: {}
  };
  readonly messages: Record<string, MessageMetadata<unknown>> = {};
  readonly documentation: Record<string, { description: string }> = {};
  private _hasStreams = false;
  get hasStreams(): boolean {
    return this._hasStreams;
  }

  private _msg<T>(name: keyof T & string): MessageMetadata<T> {
    let msg = this.messages[name] as MessageMetadata<T>;
    if (!msg) {
      msg = {
        name,
        eventHandlerFactories: {}
      } as MessageMetadata<T>;
      this.messages[name] = msg as MessageMetadata<unknown>;
    }
    return msg;
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
  >(factory: EventHandlerFactory<M, C, E>, description?: string): void {
    if (this._factories.eventHandlers[factory.name])
      throw Error(`Duplicate event handler ${factory.name}`);
    this._factories.eventHandlers[factory.name] = factory;
    this.documentation[factory.name] = { description };
    this._registerSchemas(factory(""));
  }

  private _registerCommandHandlerFactory<
    M extends Payload,
    C extends Messages,
    E extends Messages
  >(factory: CommandHandlerFactory<M, C, E>, description?: string): void {
    if (this._factories.commandHandlers[factory.name])
      throw Error(`Duplicate command handler ${factory.name}`);
    this._factories.commandHandlers[factory.name] = factory;
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
   * Registers event handler factories
   * @param factories event handler factories
   */
  withEventHandlers(
    ...factories: EventHandlerFactory<Payload, any, any>[]
  ): this {
    factories.map((f) => this._registerEventHandlerFactory(f));
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
   * Registers command handler factories
   * @param factories command handler factories
   */
  withCommandHandlers(
    ...factories: CommandHandlerFactory<Payload, any, any>[]
  ): this {
    factories.map((f) => this._registerCommandHandlerFactory(f));
    return this;
  }

  /**
   * Registers command adapters
   * @param factory command adapter factory
   */
  withCommandAdapter<P extends Payload, C extends Messages>(
    factory: CommandAdapterFactory<P, C>
  ): this {
    this._factories.commandAdapters[factory.name] = factory;
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
      const handler = factory(undefined);
      const reducible = getReducible(handler);
      const type: CommandHandlerType = reducible
        ? "aggregate"
        : "external-system";
      const events =
        reducible &&
        eventsOf(reducible).map((name) => {
          this._msg(name);
          return name;
        });
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
      const handler = factory(undefined);
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

    // schemas
    Object.values(this.messages).forEach(
      (msg) => (this.endpoints.schemas[msg.name] = msg.schema?.describe())
    );

    return;
  }
}
