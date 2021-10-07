import { externalSystemCommandPath } from ".";
import { Broker } from "./Broker";
import { Log, log } from "./log";
import { Store } from "./Store";
import {
  Aggregate,
  AggregateFactory,
  EvtOf,
  MessageFactory,
  ModelReducer,
  MsgOf,
  Payload,
  PolicyFactory,
  PolicyResponse,
  Snapshot,
  ExternalSystem,
  ExternalSystemFactory
} from "./types";
import { aggregateCommandPath, policyEventPath, handlersOf } from "./utils";

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase {
  public readonly log: Log = log();

  private _event_factory: MessageFactory<unknown> = {};
  private _command_factory: MessageFactory<unknown> = {};
  private _aggregate_factories: {
    [name: string]: AggregateFactory<Payload, unknown, unknown>;
  } = {};
  private _externalsystem_factories: {
    [name: string]: ExternalSystemFactory<unknown, unknown>;
  } = {};
  private _policy_factories: {
    [name: string]: PolicyFactory<unknown, unknown, Payload>;
  } = {};

  protected _aggregate_handlers: {
    [name: string]: {
      factory: AggregateFactory<Payload, unknown, unknown>;
      command: MsgOf<unknown>;
      path: string;
    };
  } = {};
  protected _externalsystem_handlers: {
    [name: string]: {
      factory: ExternalSystemFactory<unknown, unknown>;
      command: MsgOf<unknown>;
      path: string;
    };
  } = {};
  protected _policy_handlers: {
    [path: string]: {
      factory: PolicyFactory<unknown, unknown, Payload>;
      event: EvtOf<unknown>;
      path: string;
    };
  } = {};

  protected _store: Store;
  protected _broker: Broker;

  /**
   * Applies events to model
   * @param reducer model reducer
   * @param events events to apply
   * @param state initial model state
   * @returns snapshots
   */
  private _apply<M extends Payload, E>(
    reducer: ModelReducer<M, E>,
    events: EvtOf<E>[],
    state: M
  ): Snapshot<M>[] {
    return events.map((event) => {
      this.log.trace(
        "gray",
        `   ... committed ${event.name} @ ${event.version} - `,
        event.data
      );
      state = (reducer as any)["apply".concat(event.name)](state, event);
      this.log.trace("gray", `   === @ ${event.version}`, state);
      return { event, state };
    });
  }

  /**
   * Registers event factory
   * @param factory event factory
   */
  public withEvents<E>(factory: MessageFactory<E>): this {
    this._event_factory = factory;
    return this;
  }

  /**
   * Registers command factory
   * @param factory command factory
   */
  public withCommands<C>(factory: MessageFactory<C>): this {
    this._command_factory = factory;
    return this;
  }

  /**
   * Registers aggregate factory
   * @param factory aggregate factory
   */
  public withAggregate<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>
  ): this {
    this._aggregate_factories[factory.name] = factory;
    return this;
  }

  /**
   * Registers external system factory
   * @param factory external system factory
   */
  public withExternalSystem<C, E>(factory: ExternalSystemFactory<C, E>): this {
    this._externalsystem_factories[factory.name] = factory;
    return this;
  }

  /**
   * Registers policy factory
   * @param factory policy factory
   */
  public withPolicy<C, E, M extends Payload>(
    factory: PolicyFactory<C, E, M>
  ): this {
    this._policy_factories[factory.name] = factory;
    return this;
  }

  /**
   * Prepares handlers
   */
  protected prepare(): void {
    Object.values(this._aggregate_factories).map((factory) => {
      const aggregate = factory("");
      handlersOf(this._command_factory).map((f) => {
        const command = f() as MsgOf<unknown>;
        const path = aggregateCommandPath(factory, command);
        if (Object.keys(aggregate).includes("on".concat(command.name))) {
          this._aggregate_handlers[command.name] = {
            factory,
            command,
            path
          };
          this.log.info("blue", `[POST ${command.name}]`, path);
        }
      });
    });

    Object.values(this._externalsystem_factories).map((factory) => {
      const externalsystem = factory();
      handlersOf(this._command_factory).map((f) => {
        const command = f() as MsgOf<unknown>;
        const path = externalSystemCommandPath(factory, command);
        if (Object.keys(externalsystem).includes("on".concat(command.name))) {
          this._externalsystem_handlers[command.name] = {
            factory,
            command,
            path
          };
          this.log.info("blue", `[POST ${command.name}]`, path);
        }
      });
    });

    Object.values(this._policy_factories).map((factory) => {
      const policy = factory(undefined);
      handlersOf(this._event_factory).map((f) => {
        const event = f() as EvtOf<unknown>;
        if (Object.keys(policy).includes("on".concat(event.name))) {
          const path = policyEventPath(factory, event);
          this._policy_handlers[path] = { factory, event, path };
          this.log.info("magenta", `[POST ${event.name}]`, path);
        }
      });
    });
  }

  /**
   * Connects the dots...creates event topics, subscribes event handlers
   */
  protected async connect(): Promise<void> {
    await this._store.init();

    await Promise.all(
      handlersOf(this._event_factory).map((f) =>
        this._broker
          .topic(f())
          .then(() => this.log.info("red", `> ${f.name} <`))
      )
    );

    await Promise.all(
      Object.values(this._policy_handlers).map(({ factory, event }) =>
        this._broker.subscribe(factory, event)
      )
    );
  }

  /**
   * Builds application
   * @param options options for store and broker
   */
  abstract build(options?: { store?: Store; broker?: Broker }): unknown;

  /**
   * Connects the dots and starts listening
   * @param silent flag (when gcloud functions manage the listening part)
   */
  abstract listen(silent?: boolean): Promise<void>;

  /**
   * Closes the listening app
   */
  abstract close(): Promise<void>;

  /**
   * Handles commands
   * @param handler the aggregate or system with command handlers
   * @param command the command to handle
   * @param expectedVersion optional aggregate expected version to allow optimistic concurrency
   * @returns array of snapshots produced by this command
   */
  async command<M extends Payload, C, E>(
    handler: Aggregate<M, C, E> | ExternalSystem<C, E>,
    command: MsgOf<C>,
    expectedVersion?: string
  ): Promise<Snapshot<M>[]> {
    this.log.trace(
      "blue",
      `\n>>> ${command.name} ${handler.stream()}`,
      command.data
    );
    const aggregate = "init" in handler ? handler : undefined;

    const { state } = aggregate ? await this.load(aggregate) : undefined;

    const events: MsgOf<E>[] = await (handler as any)[
      "on".concat(command.name)
    ](command.data, state);

    const committed = await this._store.commit<E>(
      handler.stream(),
      events,
      expectedVersion
    );

    const snapshots = aggregate
      ? this._apply(aggregate, committed, state)
      : committed.map((event) => ({ event }));

    try {
      await Promise.all(committed.map((event) => this._broker.emit(event)));
    } catch (error) {
      // TODO: monitor broker failures
      // log.error cannot raise!
      this.log.error(error);
    }

    return snapshots;
  }

  /**
   * Handles policy events and optionally invokes command on target aggregate - side effect
   * @param factory the policy factory
   * @param event the triggering event
   * @returns policy response
   */
  async event<C, E, M extends Payload>(
    factory: PolicyFactory<C, E, M>,
    event: EvtOf<E>
  ): Promise<PolicyResponse<C> | undefined> {
    const policy = factory(event);
    this.log.trace(
      "magenta",
      `\n>>> ${event.name} ${factory.name}`,
      event.data
    );

    const { state } = policy.reducer
      ? await this.load(policy.reducer)
      : { state: undefined };

    const response: PolicyResponse<unknown> | undefined = await (policy as any)[
      "on".concat(event.name)
    ](event, state);

    if (policy.reducer)
      await this._store.commit<E>(policy.reducer.stream(), [
        event as unknown as MsgOf<E>
      ]);

    if (response) {
      const { id, command, expectedVersion } = response;
      if (id) {
        this.log.trace(
          "blue",
          `<<< ${command.name} ${id}`,
          `@ ${expectedVersion}`
        );
        const { factory } = this._aggregate_handlers[command.name];
        await this.command(factory(id), command, expectedVersion);
      } else {
        this.log.trace("blue", `<<< ${command.name}`);
        const { factory } = this._externalsystem_handlers[command.name];
        await this.command(factory(), command);
      }
    }
    return response;
  }

  /**
   * Loads the last snapshot for the given stream.
   * @param stream The stream to load the snapshot for
   * @returns Instance of Snappshot (event, state)
   */
  async loadSnapshot<M extends Payload>(stream:string): Promise<Snapshot<M>>{
    const event = await this._store.getLastEvent(`${stream}-snapshot`);
    event && this.log.trace(
      "white",
      `<<< SNAPSHOT Loaded`,
      `Stream: ${stream}`
    );
    return event?.data as {state: M, event:Evt};
  }
  /**
   * Loads current model state
   * @param reducer model reducer
   * @param callback optional reduction predicate
   * @returns current model state
   */
  async load<M extends Payload, E>(
    reducer: ModelReducer<M, E>,
    callback?: (snapshot: Snapshot<M>) => void
  ): Promise<Snapshot<M>> {
    let event: EvtOf<E>;
    let state = reducer.init();
    let count = 0;
    await this._store.load<E>(reducer.stream(), (e) => {
      event = e;
      state = (reducer as any)["apply".concat(e.name)](state, e);
      count++;
      if (callback) callback({ event, state });
    });
    this.log.trace(
      "gray",
      `   ... ${reducer.stream()} loaded ${count} event(s)`
    );
    return { event, state };
  }

  /**
   * Loads stream
   * @param reducer model reducer
   * @returns stream log with events and state transitions
   */
  async stream<M extends Payload, E>(
    reducer: ModelReducer<M, E>
  ): Promise<Snapshot<M>[]> {
    const log: Snapshot<M>[] = [];
    await this.load(reducer, (snapshot) => log.push(snapshot));
    return log;
  }
}
