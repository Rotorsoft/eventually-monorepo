import {
  AggregateFactory,
  commandHandlerPath,
  eventHandlerPath,
  Evt,
  ExternalSystemFactory,
  handlersOf,
  log,
  MessageFactory,
  Msg,
  Payload,
  PolicyFactory,
  ProcessManagerFactory
} from ".";

export type Factories = {
  commands: MessageFactory<unknown>;
  commandHandlerFactories: {
    [name: string]:
      | AggregateFactory<Payload, unknown, unknown>
      | ExternalSystemFactory<unknown, unknown>;
  };
  events: MessageFactory<unknown>;
  eventHandlerFactories: {
    [name: string]:
      | PolicyFactory<unknown, unknown>
      | ProcessManagerFactory<Payload, unknown, unknown>;
  };
};

export type Handlers = {
  commandHandlers: {
    [name: string]: {
      type: "aggregate" | "external-system";
      factory:
        | AggregateFactory<Payload, unknown, unknown>
        | ExternalSystemFactory<unknown, unknown>;
      command: Msg;
      path: string;
    };
  };
  eventHandlers: {
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

export class Builder {
  private _factories: Factories = {
    commands: {},
    commandHandlerFactories: {},
    events: {},
    eventHandlerFactories: {}
  };

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
    factories.map((f) => (this._factories.commandHandlerFactories[f.name] = f));
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
    factories.map((f) => (this._factories.eventHandlerFactories[f.name] = f));
    return this;
  }

  /**
   * Builds handlers
   */
  protected handlers(): Handlers {
    const handlers: Handlers = {
      commandHandlers: {},
      eventHandlers: {}
    };

    Object.values(this._factories.commandHandlerFactories).map((chf) => {
      const handler = chf(undefined);
      handlersOf(this._factories.commands).map((cf) => {
        const command = cf() as Msg;
        const path = commandHandlerPath(chf, command);
        if (Object.keys(handler).includes("on".concat(command.name))) {
          handlers.commandHandlers[command.name] = {
            type: "init" in handler ? "aggregate" : "external-system",
            factory: chf,
            command,
            path
          };
          log().info("blue", `[POST ${command.name}]`, path);
        }
      });
    });

    Object.values(this._factories.eventHandlerFactories).map((ehf) => {
      const handler = ehf(undefined);
      handlersOf(this._factories.events).map((ef) => {
        const event = ef() as Evt;
        if (Object.keys(handler).includes("on".concat(event.name))) {
          const path = eventHandlerPath(ehf, event);
          handlers.eventHandlers[path] = {
            type: "init" in handler ? "process-manager" : "policy",
            factory: ehf,
            event,
            path
          };
          log().info("magenta", `[POST ${event.name}]`, path);
        }
      });
    });

    return handlers;
  }
}
