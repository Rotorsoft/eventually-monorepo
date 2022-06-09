import Joi from "joi";
import {
  AggregateFactory,
  CommandHandlerFactory,
  commandHandlerPath,
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
import { InMemorySnapshotStore } from "./__dev__";

export type Factories = {
  commandHandlers: {
    [name: string]: CommandHandlerFactory<Payload, unknown, unknown>;
  };
  eventHandlers: {
    [name: string]: EventHandlerFactory<Payload, unknown, unknown>;
  };
};

export type Endpoints = {
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

export class Builder {
  protected readonly _snapshotStores: Record<string, SnapshotStore> = {};
  protected readonly _factories: Factories = {
    commandHandlers: {},
    eventHandlers: {}
  };
  readonly endpoints: Endpoints = {
    commandHandlers: {},
    eventHandlers: {}
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

  private _registerEventHandlerFactory<C, E>(
    factory: EventHandlerFactory<Payload, C, E>,
    description?: string
  ): void {
    if (this._factories.eventHandlers[factory.name])
      throw Error(`Duplicate event handler ${factory.name}`);
    this._factories.eventHandlers[factory.name] = factory;
    this.documentation[factory.name] = { description };
  }

  private _registerCommandHandlerFactory<C, E>(
    factory: CommandHandlerFactory<Payload, C, E>,
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
  withProcessManager<C, E>(
    factory: ProcessManagerFactory<Payload, C, E>,
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
   */
  withAggregate<C, E>(
    factory: AggregateFactory<Payload, C, E>,
    description?: string
  ): this {
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

  getSnapshotStore<M extends Payload, E>(
    reducible: Reducible<M, E>
  ): SnapshotStore {
    const factory = reducible?.snapshot?.factory || InMemorySnapshotStore;
    let store = this._snapshotStores[factory.name];
    !store && (store = this._snapshotStores[factory.name] = factory());
    return store;
  }

  protected async readSnapshot<M extends Payload, E>(
    reducible: Reducible<M, E>
  ): Promise<Snapshot<M>> {
    const store = this.getSnapshotStore(reducible);
    return await store.read(reducible.stream());
  }

  /**
   * Builds message handlers and private subscriptions
   * Concrete app implementations should deal with their own building steps
   * @returns optional internal application object (e.g. express)
   */
  build(): unknown | undefined {
    // command handlers
    Object.values(this._factories.commandHandlers).map((factory) => {
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
    Object.values(this._factories.eventHandlers).map((factory) => {
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

    return;
  }
}
