import Joi from "joi";
import {
  CommandHandlerFactory,
  commandHandlerPath,
  EventHandlerFactory,
  eventHandlerPath,
  eventsOf,
  getReducible,
  log,
  messagesOf,
  Payload,
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
  commands: {
    [name: string]: {
      type: "aggregate" | "external-system";
      name: string;
      factory: CommandHandlerFactory<Payload, unknown, unknown>;
      path: string;
    };
  };
  eventHandlers: {
    [name: string]: {
      type: "policy" | "process-manager";
      factory: EventHandlerFactory<Payload, unknown, unknown>;
      path: string;
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
    commands: {},
    eventHandlers: {}
  };
  readonly messages: Record<string, MessageMetadata> = {};

  private _msg(name: string): MessageMetadata {
    return (this.messages[name] = this.messages[name] || {
      name,
      eventHandlerFactories: {}
    });
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
    factories.map((f) => {
      if (this._factories.eventHandlers[f.name])
        throw Error(`Duplicate event handler ${f.name}`);
      this._factories.eventHandlers[f.name] = f;
    });
    return this;
  }

  /**
   * Registers command handler factories
   * @param factories command handler factories
   */
  withCommandHandlers(
    ...factories: CommandHandlerFactory<Payload, unknown, unknown>[]
  ): this {
    factories.map((f) => {
      if (this._factories.commandHandlers[f.name])
        throw Error(`Duplicate command handler ${f.name}`);
      this._factories.commandHandlers[f.name] = f;
    });
    return this;
  }

  private async getSnapshotStore<M extends Payload, E>(
    reducible: Reducible<M, E>
  ): Promise<SnapshotStore> {
    const factory = reducible?.snapshot?.factory || InMemorySnapshotStore;
    let store = this._snapshotStores[factory.name];
    if (!store) {
      store = this._snapshotStores[factory.name] = factory();
      await store.init();
    }
    return store;
  }

  protected async readSnapshot<M extends Payload, E>(
    reducible: Reducible<M, E>
  ): Promise<Snapshot<M>> {
    const store = await this.getSnapshotStore(reducible);
    return await store.read(reducible.stream());
  }

  protected async upsertSnapshot<M extends Payload, E>(
    reducible: Reducible<M, E>,
    snapshot: Snapshot<M>
  ): Promise<void> {
    const store = await this.getSnapshotStore(reducible);
    await store.upsert(reducible.stream(), snapshot);
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
      messagesOf(handler).map((name) => {
        const msg = this._msg(name);
        msg.commandHandlerFactory = factory;
        const path = commandHandlerPath(factory, name);
        this.endpoints.commands[path] = {
          type,
          name,
          factory,
          path
        };
        log().info("bgBlue", " POST ", path);
      });
      reducible && eventsOf(reducible).map((name) => this._msg(name));
    });

    // event handlers
    Object.values(this._factories.eventHandlers).map((factory) => {
      const handler = factory(undefined);
      const reducible = getReducible(handler);
      const type = reducible ? "process-manager" : "policy";
      const path = eventHandlerPath(factory);
      this.endpoints.eventHandlers[path] = {
        type,
        factory,
        path
      };
      const events = messagesOf(handler).map((name) => {
        const msg = this._msg(name);
        msg.eventHandlerFactories[path] = factory;
        return name;
      });
      log().info("bgMagenta", " POST ", path, events);
    });

    return;
  }
}
