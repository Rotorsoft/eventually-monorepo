import {
  CommandHandlerFactory,
  commandHandlerPath,
  EventHandlerFactory,
  eventHandlerPath,
  getReducible,
  log,
  MessageFactories,
  MessageFactory,
  Payload,
  Reducible,
  Scopes
} from ".";
import { SnapshotStore } from "./interfaces";
import { InMemorySnapshotStore } from "./__dev__";

export type Factories = {
  commands: Record<string, MessageFactory<string, Payload>>;
  commandHandlers: {
    [name: string]: CommandHandlerFactory;
  };
  events: Record<string, MessageFactory<string, Payload>>;
  eventHandlers: {
    [name: string]: EventHandlerFactory;
  };
};

export type Handlers = {
  commands: {
    [name: string]: {
      type: "aggregate" | "external-system";
      factory: CommandHandlerFactory;
      command: MessageFactory<string, Payload>;
      path: string;
    };
  };
  events: {
    [path: string]: {
      type: "policy" | "process-manager";
      factory: EventHandlerFactory;
      event: MessageFactory<string, Payload>;
      path: string;
    };
  };
};

export type Subscriptions = {
  [name: string]: EventHandlerFactory[];
};

export class Builder {
  protected readonly _factories: Factories = {
    commands: {},
    commandHandlers: {},
    events: {},
    eventHandlers: {}
  };

  protected readonly _handlers: Handlers = {
    commands: {},
    events: {}
  };

  protected readonly _snapshotStores: Record<string, SnapshotStore> = {};

  protected readonly _private_subscriptions: Subscriptions = {};

  /**
   * Registers events factory
   * @param factory event factory
   */
  withEvents<E>(factory: MessageFactories<E>): this {
    Object.entries(factory).map(
      ([key, value]: [string, MessageFactory<string, Payload>]): void => {
        if (this._factories.events[key]) throw Error(`Duplicate event ${key}`);
        this._factories.events[key] = value;
      }
    );
    return this;
  }

  /**
   * Registers commands factory
   * @param factory command factory
   */
  withCommands<C>(factory: MessageFactories<C>): this {
    Object.entries(factory).map(
      ([key, value]: [string, MessageFactory<string, Payload>]): void => {
        if (this._factories.commands[key])
          throw Error(`Duplicate command ${key}`);
        this._factories.commands[key] = value;
      }
    );
    return this;
  }

  /**
   * Registers event handler factories
   * @param factories event handler factories
   */
  withEventHandlers(...factories: EventHandlerFactory[]): this {
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
  withCommandHandlers(...factories: CommandHandlerFactory[]): this {
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
    Object.values(this._factories.commandHandlers).map((chf) => {
      const handler = chf(undefined);
      const reducible = getReducible(handler);
      reducible && this.registerSnapshotStore(reducible);
      const type = reducible ? "aggregate" : "external-system";
      log().info("white", chf.name, type);
      Object.values(this._factories.commands).map((cf) => {
        const command = cf();
        const path = commandHandlerPath(chf, cf.name);
        if (Object.keys(handler).includes("on".concat(cf.name))) {
          this._handlers.commands[cf.name] = {
            type,
            factory: chf,
            command: cf,
            path
          };
          log().info(
            "blue",
            `  ${cf.name}`,
            command.scope === Scopes.public ? `POST ${path}` : chf.name
          );
        }
      });
    });

    // event handlers
    Object.values(this._factories.eventHandlers).map((ehf) => {
      const handler = ehf(undefined);
      const reducible = getReducible(handler);
      reducible && this.registerSnapshotStore(reducible);
      const type = reducible ? "process-manager" : "policy";
      log().info("white", ehf.name, type);
      Object.values(this._factories.events).map((ef) => {
        const event = ef();
        if (Object.keys(handler).includes("on".concat(ef.name))) {
          const path = eventHandlerPath(ehf, ef.name);
          this._handlers.events[path] = {
            type,
            factory: ehf,
            event: ef,
            path
          };
          log().info(
            "magenta",
            `  ${ef.name}]`,
            event.scope === Scopes.public ? `POST ${path}` : ehf.name
          );
        }
      });
    });

    // private subscriptions
    Object.values(this._handlers.events)
      .filter(
        ({ event }) => (event().scope || Scopes.private) === Scopes.private
      )
      .map(({ factory, event }) => {
        const sub = (this._private_subscriptions[event.name] =
          this._private_subscriptions[event.name] || []);
        sub.push(factory);
      });

    return;
  }
}
