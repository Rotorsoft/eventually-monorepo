import {
  aggregateCommandPath,
  AggregateFactory,
  EvtOf,
  externalSystemCommandPath,
  ExternalSystemFactory,
  handlersOf,
  log,
  MessageFactory,
  MsgOf,
  Payload,
  policyEventPath,
  PolicyFactory
} from ".";

export type Factories = {
  events: MessageFactory<unknown>;
  commands: MessageFactory<unknown>;
  aggregates: {
    [name: string]: AggregateFactory<Payload, unknown, unknown>;
  };
  systems: {
    [name: string]: ExternalSystemFactory<unknown, unknown>;
  };
  policies: {
    [name: string]: PolicyFactory<unknown, unknown, Payload>;
  };
};

export type Handlers = {
  aggregates: {
    [name: string]: {
      factory: AggregateFactory<Payload, unknown, unknown>;
      command: MsgOf<unknown>;
      path: string;
    };
  };
  systems: {
    [name: string]: {
      factory: ExternalSystemFactory<unknown, unknown>;
      command: MsgOf<unknown>;
      path: string;
    };
  };
  policies: {
    [path: string]: {
      factory: PolicyFactory<unknown, unknown, Payload>;
      event: EvtOf<unknown>;
      path: string;
    };
  };
};

export class Builder {
  private _factories: Factories = {
    events: {},
    commands: {},
    aggregates: {},
    systems: {},
    policies: {}
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
   * Registers aggregate factories
   * @param factories aggregate factories
   */
  withAggregates(
    ...factories: AggregateFactory<Payload, unknown, unknown>[]
  ): this {
    factories.map((f) => (this._factories.aggregates[f.name] = f));
    return this;
  }

  /**
   * Registers external system factories
   * @param factories external system factories
   */
  withSystems(...factories: ExternalSystemFactory<unknown, unknown>[]): this {
    factories.map((f) => (this._factories.systems[f.name] = f));
    return this;
  }

  /**
   * Registers policy factories
   * @param factories policy factories
   */
  withPolicies(...factories: PolicyFactory<unknown, unknown, Payload>[]): this {
    factories.map((f) => (this._factories.policies[f.name] = f));
    return this;
  }

  /**
   * Builds handlers
   */
  protected handlers(): Handlers {
    const handlers: Handlers = {
      aggregates: {},
      systems: {},
      policies: {}
    };

    Object.values(this._factories.aggregates).map((factory) => {
      const aggregate = factory("");
      handlersOf(this._factories.commands).map((f) => {
        const command = f() as MsgOf<unknown>;
        const path = aggregateCommandPath(factory, command);
        if (Object.keys(aggregate).includes("on".concat(command.name))) {
          handlers.aggregates[command.name] = {
            factory,
            command,
            path
          };
          log().info("blue", `[POST ${command.name}]`, path);
        }
      });
    });

    Object.values(this._factories.systems).map((factory) => {
      const externalsystem = factory();
      handlersOf(this._factories.commands).map((f) => {
        const command = f() as MsgOf<unknown>;
        const path = externalSystemCommandPath(factory, command);
        if (Object.keys(externalsystem).includes("on".concat(command.name))) {
          handlers.systems[command.name] = {
            factory,
            command,
            path
          };
          log().info("blue", `[POST ${command.name}]`, path);
        }
      });
    });

    Object.values(this._factories.policies).map((factory) => {
      const policy = factory(undefined);
      handlersOf(this._factories.events).map((f) => {
        const event = f() as EvtOf<unknown>;
        if (Object.keys(policy).includes("on".concat(event.name))) {
          const path = policyEventPath(factory, event);
          handlers.policies[path] = { factory, event, path };
          log().info("magenta", `[POST ${event.name}]`, path);
        }
      });
    });

    return handlers;
  }
}
