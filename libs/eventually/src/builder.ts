import {
  AggregateFactory,
  commandHandlerPath,
  eventHandlerPath,
  Evt,
  ExternalSystemFactory,
  getReducible,
  handlersOf,
  log,
  MessageFactory,
  Msg,
  Payload,
  PolicyFactory,
  ProcessManagerFactory
} from ".";
import {SnapshotStore} from "./interfaces";

type Factories = {
  commands: MessageFactory<unknown>;
  commandHandlers: {
    [name: string]:
      | AggregateFactory<Payload, unknown, unknown>
      | ExternalSystemFactory<unknown, unknown>;
  };
  events: MessageFactory<unknown>;
  eventHandlers: {
    [name: string]:
      | PolicyFactory<unknown, unknown>
      | ProcessManagerFactory<Payload, unknown, unknown>;
  };
};

type Handlers = {
  commands: {
    [name: string]: {
      type: "aggregate" | "external-system";
      factory:
        | AggregateFactory<Payload, unknown, unknown>
        | ExternalSystemFactory<unknown, unknown>;
      command: Msg;
      path: string;
    };
  };
  events: {
    [path: string]: {
      type: "policy" | "process-manager";
      factory:
        | PolicyFactory<unknown, unknown>
        | ProcessManagerFactory<Payload, unknown, unknown>;
      event: Evt;
      path: string;
    };
  };
};

export type Subscriptions = {
  [name: string]: (
    | PolicyFactory<unknown, unknown>
    | ProcessManagerFactory<Payload, unknown, unknown>
  )[];
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
  withEvents(factory: MessageFactory<unknown>): this {
    this._factories.events = factory;
    return this;
  }

  /**
   * Registers commands factory
   * @param factory command factory
   */
  withCommands(factory: MessageFactory<unknown>): this {
    this._factories.commands = factory;
    return this;
  }

  /**
   * Registers command handler factories
   * @param factories command handler factories
   */
  withCommandHandlers(
    ...factories: (
      | AggregateFactory<Payload, unknown, unknown>
      | ExternalSystemFactory<unknown, unknown>
    )[]
  ): this {
    factories.map((f) => (this._factories.commandHandlers[f.name] = f));
    return this;
  }

  /**
   * Registers event handler factories
   * @param factories event handler factories
   */
  withEventHandlers(
    ...factories: (
      | PolicyFactory<unknown, unknown>
      | ProcessManagerFactory<Payload, unknown, unknown>
    )[]
  ): this {
    factories.map((f) => (this._factories.eventHandlers[f.name] = f));
    return this;
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
      if (reducible?.snapshot){
        this._snapshotStores[reducible.snapshot.store.name] = this._snapshotStores[reducible.snapshot.store.name] || reducible.snapshot.store()
      }
      const type = reducible ? "aggregate" : "external-system";
      log().info("white", chf.name, type);
      handlersOf(this._factories.commands).map((cf) => {
        const command = cf() as Msg;
        const path = commandHandlerPath(chf, command);
        if (Object.keys(handler).includes("on".concat(command.name))) {
          this._handlers.commands[command.name] = {
            type,
            factory: chf,
            command,
            path
          };
          log().info(
            "blue",
            `  ${command.name}`,
            command.scope() === "public" ? `POST ${path}` : chf.name
          );
        }
      });
    });

    // event handlers
    Object.values(this._factories.eventHandlers).map((ehf) => {
      const handler = ehf(undefined);
      const reducible = getReducible(handler);
      if (reducible?.snapshot){
        this._snapshotStores[reducible.snapshot.store.name] = this._snapshotStores[reducible.snapshot.store.name] || reducible.snapshot.store()
      }
      const type = reducible ? "process-manager" : "policy";
      log().info("white", ehf.name, type);
      handlersOf(this._factories.events).map((ef) => {
        const event = ef();
        if (Object.keys(handler).includes("on".concat(event.name))) {
          const path = eventHandlerPath(ehf, event);
          this._handlers.events[path] = {
            type,
            factory: ehf,
            event,
            path
          };
          log().info(
            "magenta",
            `  ${event.name}]`,
            event.scope() === "public" ? `POST ${path}` : ehf.name
          );
        }
      });
    });

    // private subscriptions
    Object.values(this._handlers.events)
      .filter(({ event }) => event.scope() === "private")
      .map(({ factory, event }) => {
        const sub = (this._private_subscriptions[event.name] =
          this._private_subscriptions[event.name] || []);
        sub.push(factory);
      });

    return;
  }
}
