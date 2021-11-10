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

export type Subscriptions = {
  [name: string]: EventHandlerFactory<Payload, unknown, unknown>[];
};

type Schemas<M> = {
  [Key in keyof M & string]: Joi.ObjectSchema<M[Key] & Payload>;
};

export class Builder {
  protected readonly _options: Record<string, Options<Payload>> = {};
  protected readonly _factories: Factories = {
    commandHandlers: {},
    eventHandlers: {}
  };
  protected readonly _endpoints: Endpoints = {
    commands: {},
    events: {}
  };
  protected readonly _snapshotStores: Record<string, SnapshotStore> = {};
  protected readonly _commandHandlerFactories: Record<
    string,
    CommandHandlerFactory<Payload, unknown, unknown>
  > = {};
  protected readonly _privateSubs: Subscriptions = {};

  /**
   * Registers message schemas
   * @param schemas Message validation schemas
   */
  withSchemas<M>(schemas: Schemas<M>): this {
    Object.entries(schemas).map(([key, value]): void => {
      const option = (this._options[key] = this._options[key] || {
        scope: Scopes.public
      });
      option.schema = value as any;
    });
    return this;
  }

  /**
   * Registers private messages
   */
  withPrivate<M>(...messages: Array<keyof M & string>): this {
    messages.map((key): void => {
      const option = (this._options[key] = this._options[key] || {
        scope: Scopes.private
      });
      option.scope = Scopes.private;
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
        const options = (this._options[name] = this._options[name] || {
          scope: Scopes.public
        });
        const path =
          options.scope === Scopes.public
            ? commandHandlerPath(factory, name)
            : "";
        path &&
          (this._endpoints.commands[path] = {
            type,
            name,
            factory,
            path
          });
        this._commandHandlerFactories[name] = factory;
        log().info("blue", `  ${name}`, path ? `POST ${path}` : factory.name);
      });
      reducible &&
        eventsOf(reducible).map((name) => {
          this._options[name] = this._options[name] || { scope: Scopes.public };
        });
    });

    // event handlers
    Object.values(this._factories.eventHandlers).map((factory) => {
      const handler = factory(undefined);
      const reducible = getReducible(handler);
      reducible && this.registerSnapshotStore(reducible);
      const type = reducible ? "process-manager" : "policy";
      log().info("white", factory.name, type);
      messagesOf(handler).map((name) => {
        const options = (this._options[name] = this._options[name] || {
          scope: Scopes.public
        });
        const path =
          options.scope === Scopes.public
            ? eventHandlerPath(factory, name)
            : "";
        if (path)
          this._endpoints.events[path] = {
            type,
            name,
            factory,
            path
          };
        else {
          // cache private subscriptions
          const sub = (this._privateSubs[name] = this._privateSubs[name] || []);
          sub.push(factory);
        }
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
