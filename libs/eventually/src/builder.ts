import Joi from "joi";
import {
  AggregateFactory,
  CommandHandlerFactory,
  commandHandlerPath,
  config,
  EventHandlerFactory,
  eventHandlerPath,
  eventsOf,
  ExternalSystemFactory,
  getReducible,
  messagesOf,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  Reducible,
  Snapshot
} from ".";
import { SnapshotStore } from "./interfaces";

export type Factories = {
  commandHandlers: {
    [name: string]: CommandHandlerFactory<Payload, unknown, unknown>;
  };
  eventHandlers: {
    [name: string]: EventHandlerFactory<Payload, unknown, unknown>;
  };
};

export type Endpoints = {
  version: string;
  commandHandlers: {
    [name: string]: {
      type: "aggregate" | "external-system";
      factory: CommandHandlerFactory<Payload, unknown, unknown>;
      commands: Record<string, string>;
      events: string[];
    };
  };
  eventHandlers: {
    [name: string]: {
      type: "policy" | "process-manager";
      factory: EventHandlerFactory<Payload, unknown, unknown>;
      path: string;
      events: string[];
    };
  };
  schemas: {
    [name: string]: Joi.Description;
  };
};

export type MessageMetadata = {
  name: string;
  schema?: Joi.ObjectSchema<Payload>;
  commandHandlerFactory?: CommandHandlerFactory<Payload, unknown, unknown>;
  eventHandlerFactories: Record<
    string,
    EventHandlerFactory<Payload, unknown, unknown>
  >;
};

type Schemas<M> = {
  [Key in keyof M & string]: Joi.ObjectSchema<M[Key] & Payload>;
};

type SnapshotOptions = {
  store: SnapshotStore;
  threshold?: number;
  expose?: boolean;
};

export class Builder {
  protected readonly _snapshotOptions: Record<string, SnapshotOptions> = {};
  protected readonly _factories: Factories = {
    commandHandlers: {},
    eventHandlers: {}
  };
  readonly endpoints: Endpoints = {
    version: "",
    commandHandlers: {},
    eventHandlers: {},
    schemas: {}
  };
  readonly messages: Record<string, MessageMetadata> = {};
  readonly documentation: Record<string, { description: string }> = {};
  private _hasStreams = false;
  get hasStreams(): boolean {
    return this._hasStreams;
  }

  private _msg(name: string): MessageMetadata {
    return (this.messages[name] = this.messages[name] || {
      name,
      eventHandlerFactories: {}
    });
  }

  private _registerEventHandlerFactory<M extends Payload, C, E>(
    factory: EventHandlerFactory<M, C, E>,
    description?: string
  ): void {
    if (this._factories.eventHandlers[factory.name])
      throw Error(`Duplicate event handler ${factory.name}`);
    this._factories.eventHandlers[factory.name] = factory;
    this.documentation[factory.name] = { description };
  }

  private _registerCommandHandlerFactory<M extends Payload, C, E>(
    factory: CommandHandlerFactory<M, C, E>,
    description?: string
  ): void {
    if (this._factories.commandHandlers[factory.name])
      throw Error(`Duplicate command handler ${factory.name}`);
    this._factories.commandHandlers[factory.name] = factory;
    this.documentation[factory.name] = { description };
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
  withSchemas<M>(schemas: Schemas<M>): this {
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
    ...factories: EventHandlerFactory<Payload, unknown, unknown>[]
  ): this {
    factories.map((f) => this._registerEventHandlerFactory(f));
    return this;
  }

  /**
   * Registers policy factory
   * @param factory the factory
   * @param description describes the factory
   */
  withPolicy<C, E>(factory: PolicyFactory<C, E>, description?: string): this {
    this._registerEventHandlerFactory(factory, description);
    return this;
  }

  /**
   * Registers process manager factory
   * @param factory the factory
   * @param description describes the factory
   */
  withProcessManager<M extends Payload, C, E>(
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
    ...factories: CommandHandlerFactory<Payload, unknown, unknown>[]
  ): this {
    factories.map((f) => this._registerCommandHandlerFactory(f));
    return this;
  }

  /**
   * Registers aggregate factory
   * @param factory the factory
   * @param description describes the factory
   * @param snapshotOptions optional snapshotting options
   */
  withAggregate<M extends Payload, C, E>(
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
  withExternalSystem<C, E>(
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
  async readSnapshot<M extends Payload, E>(
    reducible: Reducible<M, E>
  ): Promise<Snapshot<M> | undefined> {
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
  async writeSnapshot<M extends Payload, E>(
    reducible: Reducible<M, E>,
    snapshot: Snapshot<M>,
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
      const type = reducible ? "aggregate" : "external-system";
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
      const type = reducible ? "process-manager" : "policy";
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
