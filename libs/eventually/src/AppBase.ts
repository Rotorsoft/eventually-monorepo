import { Broker } from "./Broker";
import { Log, LogFactory } from "./log";
import { Store } from "./Store";
import {
  AggregateFactory,
  Evt,
  EvtOf,
  Listener,
  MessageFactory,
  MsgOf,
  Payload,
  PolicyFactory,
  PolicyResponse,
  Snapshot
} from "./types";
import {
  aggregateId,
  apply,
  commandPath,
  eventPath,
  handlersOf
} from "./utils";

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase {
  public readonly log: Log = LogFactory();

  private _event_factory: MessageFactory<unknown> = {};
  private _command_factory: MessageFactory<unknown> = {};
  private _aggregate_factories: {
    [name: string]: AggregateFactory<Payload, unknown, unknown>;
  } = {};
  private _policy_factories: {
    [name: string]: PolicyFactory<unknown, unknown>;
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
      factory: PolicyFactory<unknown, unknown>;
      event: Evt;
      path: string;
    };
  } = {};

  protected _store: Store;
  protected _broker: Broker;

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
  public withPolicy<C, E>(factory: PolicyFactory<C, E>): this {
    this._policy_factories[factory.name] = factory;
    return this;
  }

  /**
   * Builds message handlers
   */
  protected prebuild(): void {
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
      const policy = factory();
      handlersOf(this._event_factory).map((f) => {
        const event = f() as EvtOf<unknown>;
        if (Object.keys(policy).includes("on".concat(event.name))) {
          const path = eventPath(factory, event);
          this._event_handlers[path] = { factory, event, path };
          this.log.info("magenta", `[POST ${event.name}]`, path);
        }
      });
    });
  }

  /**
   * Creates topics, and subscribes event handlers
   */
  protected async connect(): Promise<void> {
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
   * Builds application
   * @param options options for store and broker
   * @returns internal application (used by gcloud functions to expose express router)
   */
  abstract build(options?: { store?: Store; broker?: Broker }): Listener;

  /**
   * Starts listening for requests
   */
  abstract listen(): Promise<void>;

  /**
   * Handles aggregate commands
   * @param aggregate the aggregate with command handlers
   * @param command the command to handle
   * @param expectedVersion optional aggregate expected version to allow optimistic concurrency
   * @returns tuple with mutated model and committed event
   */
  async command<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    id: string,
    command: MsgOf<C>,
    expectedVersion?: string
  ): Promise<Snapshot<M>> {
    const aggregate = factory(id);
    this.log.trace("blue", `\n>>> ${command.name} ${id}`, command.data);

    let { state } = await this.load(factory, id);
    if (!state) throw Error(`Invalid aggregate ${factory.name}!`);

    const event: MsgOf<E> = await (aggregate as any)["on".concat(command.name)](
      state,
      command.data
    );

    const committed = await this._store.commit<E>(
      aggregateId(factory, id),
      event,
      expectedVersion
    );
    this.log.trace(
      "gray",
      `   ... committed ${committed.name} @ ${committed.aggregateVersion} - `,
      committed.data
    );
    state = apply(aggregate, committed, state);
    this.log.trace(
      "gray",
      `   === ${command.name} state @ ${committed.aggregateVersion}`,
      state
    );

    try {
      await this._broker.emit(committed);
    } catch (error) {
      // TODO: monitor broker failures
      // log.error cannot raise!
      this.log.error(error);
    }

    return { state, event: committed };
  }

  /**
   * Handles policy events and optionally invokes command on target aggregate - side effect
   * @param policy the policy with event handlers
   * @param event the event to handle
   * @returns policy response
   */
  async event<C, E>(
    factory: PolicyFactory<C, E>,
    event: EvtOf<E>
  ): Promise<PolicyResponse<C> | undefined> {
    this.log.trace(
      "magenta",
      `\n>>> ${event.name} ${factory.name}`,
      event.data
    );

    const response: PolicyResponse<unknown> | undefined = await (
      factory() as any
    )["on".concat(event.name)](event);

    if (response) {
      const { id, command, expectedVersion } = response;
      this.log.trace(
        "blue",
        `<<< ${command.name} ${id}`,
        `@ ${expectedVersion}`
      );
      const { factory } = this._command_handlers[command.name];
      await this.command(factory, id, command, expectedVersion);
    }
    return response;
  }

  /**
   * Loads model from store - reduced to current state
   * @param factory aggregate factory
   * @param id aggregate id
   * @param callback optional reduction predicate
   * @returns loaded model
   */
  async load<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    id: string,
    callback?: (event: EvtOf<E>, state: M) => void
  ): Promise<Snapshot<M>> {
    const aggregate = factory(id);
    const log: Snapshot<M> = {
      event: undefined,
      state: aggregate.init()
    };
    let count = 0;
    await this._store.load<E>(aggregateId(factory, id), (event) => {
      log.event = event;
      log.state = apply(aggregate, event, log.state);
      count++;
      if (callback) callback(event, log.state);
    });
    this.log.trace("gray", `   ... loaded ${count} event(s)`);
    return log;
  }

  /**
   * Loads model stream from store
   * @param factory aggregate factory
   * @param id aggregate id
   * @returns stream log with events and state transitions
   */
  async stream<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    id: string
  ): Promise<Snapshot<M>[]> {
    const log: Snapshot<M>[] = [];
    await this.load(factory, id, (event, state) =>
      log.push({ event, state: state })
    );
    return log;
  }
}
