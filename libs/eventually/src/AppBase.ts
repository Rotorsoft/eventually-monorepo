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
  Snapshot
} from "./types";
import { commandPath, eventPath, handlersOf } from "./utils";

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
  private _policy_factories: {
    [name: string]: PolicyFactory<unknown, unknown, Payload>;
  } = {};

  protected _command_handlers: {
    [name: string]: {
      factory: AggregateFactory<Payload, unknown, unknown>;
      command: MsgOf<unknown>;
      path: string;
    };
  } = {};
  protected _event_handlers: {
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
   * Builds handlers, creates topics, and subscribes
   */
  protected async connect(): Promise<void> {
    Object.values(this._aggregate_factories).map((factory) => {
      const aggregate = factory("");
      handlersOf(this._command_factory).map((f) => {
        const command = f() as MsgOf<unknown>;
        const path = commandPath(factory, command);
        if (Object.keys(aggregate).includes("on".concat(command.name))) {
          this._command_handlers[command.name] = {
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
          const path = eventPath(factory, event);
          this._event_handlers[path] = { factory, event, path };
          this.log.info("magenta", `[POST ${event.name}]`, path);
        }
      });
    });

    await this._store.init();

    await Promise.all(
      handlersOf(this._event_factory).map((f) =>
        this._broker
          .topic(f())
          .then(() => this.log.info("red", `> ${f.name} <`))
      )
    );

    await Promise.all(
      Object.values(this._event_handlers).map(({ factory, event }) =>
        this._broker.subscribe(factory, event)
      )
    );
  }

  /**
   * Builds application and starts listening for requests
   * @param options options for store, broker, and silent flag (when gcloud functions manage the listening part)
   */
  abstract listen(options?: {
    store?: Store;
    broker?: Broker;
    silent?: boolean;
  }): Promise<any | undefined>;

  /**
   * Closes the listening app
   */
  abstract close(): Promise<void>;

  /**
   * Handles aggregate commands
   * @param aggregate the aggregate with command handlers
   * @param command the command to handle
   * @param expectedVersion optional aggregate expected version to allow optimistic concurrency
   * @returns array of snapshots produced by this command
   */
  async command<M extends Payload, C, E>(
    aggregate: Aggregate<M, C, E>,
    command: MsgOf<C>,
    expectedVersion?: string
  ): Promise<Snapshot<M>[]> {
    this.log.trace(
      "blue",
      `\n>>> ${command.name} ${aggregate.stream()}`,
      command.data
    );

    const { state } = await this.load(aggregate);

    const events: MsgOf<E>[] = await (aggregate as any)[
      "on".concat(command.name)
    ](state, command.data);

    const committed = await this._store.commit<E>(
      aggregate.stream(),
      events,
      expectedVersion
    );

    const snapshots = this._apply(aggregate, committed, state);

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
      this.log.trace(
        "blue",
        `<<< ${command.name} ${id}`,
        `@ ${expectedVersion}`
      );
      const { factory } = this._command_handlers[command.name];
      await this.command(factory(id), command, expectedVersion);
    }
    return response;
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
