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
  Options,
  Payload,
  Reducible,
  Scopes
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
  events: {
    [name: string]: {
      type: "policy" | "process-manager";
      name: string;
      factory: EventHandlerFactory<Payload, unknown, unknown>;
      path: string;
    };
  };
};

type MessageMetadata = {
  options: Options<Payload>;
  commandHandlerFactory?: CommandHandlerFactory<Payload, unknown, unknown>;
  subscriptions: EventHandlerFactory<Payload, unknown, unknown>[];
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
    events: {}
  };
  readonly messages: Record<string, MessageMetadata> = {};

  private msg(name: string): MessageMetadata {
    return (this.messages[name] = this.messages[name] || {
      options: { scope: Scopes.public },
      subscriptions: []
    });
  }

  /**
   * Registers message schemas
   * @param schemas Message validation schemas
   */
  withSchemas<M>(schemas: Schemas<M>): this {
    Object.entries(schemas).map(([key, value]): void => {
      this.msg(key).options.schema = value as any;
    });
    return this;
  }

  /**
   * Registers private messages
   */
  withPrivate<M>(...messages: Array<keyof M & string>): this {
    messages.map((key): void => {
      this.msg(key).options.scope = Scopes.private;
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

  protected getSnapshotStore<M extends Payload, E>(
    reducible: Reducible<M, E>
  ): SnapshotStore | undefined {
    return (
      reducible?.snapshot &&
      this._snapshotStores[
        reducible.snapshot.factory?.name || InMemorySnapshotStore.name
      ]
    );
  }
  private registerSnapshotStore<M extends Payload, E>(
    reducible: Reducible<M, E>
  ): void {
    if (reducible?.snapshot) {
      const factory = reducible.snapshot.factory || InMemorySnapshotStore;
      this._snapshotStores[factory.name] =
        this._snapshotStores[factory.name] || factory();
    }
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
      reducible && this.registerSnapshotStore(reducible);
      const type = reducible ? "aggregate" : "external-system";
      log().info("white", factory.name, type);
      messagesOf(handler).map((name) => {
        const msg = this.msg(name);
        msg.commandHandlerFactory = factory;
        const path =
          msg.options.scope === Scopes.public
            ? commandHandlerPath(factory, name)
            : "";
        path &&
          (this.endpoints.commands[path] = {
            type,
            name,
            factory,
            path
          });
        log().info("blue", `  ${name}`, path ? `POST ${path}` : factory.name);
      });
      reducible && eventsOf(reducible).map((name) => this.msg(name));
    });

    // event handlers
    Object.values(this._factories.eventHandlers).map((factory) => {
      const handler = factory(undefined);
      const reducible = getReducible(handler);
      reducible && this.registerSnapshotStore(reducible);
      const type = reducible ? "process-manager" : "policy";
      log().info("white", factory.name, type);
      messagesOf(handler).map((name) => {
        const msg = this.msg(name);
        msg.subscriptions.push(factory);
        const path =
          msg.options.scope === Scopes.public
            ? eventHandlerPath(factory, name)
            : "";
        path &&
          (this.endpoints.events[path] = {
            type,
            name,
            factory,
            path
          });
        log().info(
          "magenta",
          `  ${name}`,
          path ? `POST ${path}` : factory.name
        );
      });
    });

    return;
  }
}
