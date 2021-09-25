import { Broker } from "./Broker";
import { Log, LogFactory } from "./log";
import { Store } from "./Store";
import {
  Aggregate,
  AggregateFactory,
  EvtOf,
  MessageFactory,
  ModelReducer,
  MsgOf,
  Payload,
  Policy,
  PolicyFactory,
  PolicyResponse,
  Snapshot
} from "./types";
import { aggregateId, apply, commandPath } from "./utils";

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase {
  public readonly log: Log = LogFactory();
  private _aggregates: {
    [name: string]: AggregateFactory<Payload, unknown, unknown>;
  } = {};

  constructor(public readonly store: Store, public readonly broker: Broker) {}

  /**
   * Builds aggregate handlers
   * @param factory aggregate factory
   * @param commands associated command factory
   */
  abstract withAggregate<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    commands: MessageFactory<C>
  ): void;

  /**
   * Builds policy handlers
   * @param factory policy factory
   * @param events associated event factory
   */
  abstract withPolicy<C, E>(
    factory: PolicyFactory<C, E>,
    events: MessageFactory<E>
  ): void;

  /**
   * Builds the internal app
   * @returns the internal app, services can call app.listen(...)
   */
  abstract build(): any;

  /**
   * Registers aggregates invoked by policies
   * @param factory aggregate factory
   * @param command command name
   */
  protected register<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    command: MsgOf<C>
  ): void {
    this._aggregates[command.name] = factory;
    this.log.trace(
      "blue",
      `[POST ${command.name}]`,
      commandPath(factory, command)
    );
  }

  /**
   * Handles aggregate commands
   * @param aggregate the aggregate with command handlers
   * @param command the command to handle
   * @param expectedVersion optional aggregate expected version to allow optimistic concurrency
   * @returns tuple with mutated model and committed event
   */
  async command<M extends Payload, C, E>(
    aggregate: Aggregate<M, C, E>,
    command: MsgOf<C>,
    expectedVersion?: string
  ): Promise<[M, EvtOf<E>]> {
    const id = aggregateId(aggregate);
    this.log.trace("blue", `\n>>> ${command.name} ${id}`, command.data);

    let { state } = await this.load<M, E>(aggregate);
    if (!state) throw Error(`Invalid aggregate ${aggregate.name}!`);

    const event: MsgOf<E> = await (aggregate as any)["on".concat(command.name)](
      state,
      command.data
    );

    const committed = await this.store.commit<E>(id, event, expectedVersion);
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
      await this.broker.emit<E>(committed);
    } catch (error) {
      // TODO monitor broker failures
      // log.error cannot raise!
      this.log.error(error);
    }

    return [state, committed];
  }

  /**
   * Handles policy events and optionally invokes command on target aggregate - side effect
   * @param policy the policy with event handlers
   * @param event the event to handle
   * @returns policy response
   */
  async event<C, E>(
    policy: Policy<C, E>,
    event: EvtOf<E>
  ): Promise<PolicyResponse<C> | undefined> {
    this.log.trace(
      "magenta",
      `\n>>> ${event.name} ${policy.name()}`,
      event.data
    );

    const response: PolicyResponse<C> | undefined = await (policy as any)[
      "on".concat(event.name)
    ](event);

    if (response) {
      const { id, command, expectedVersion } = response;
      const factory = this._aggregates[command.name];
      const aggregate = factory(id) as Aggregate<Payload, C, E>;
      this.log.trace(
        "blue",
        `<<< ${command.name} ${aggregateId(aggregate)}`,
        ` @ ${expectedVersion}`
      );
      await this.command(aggregate, command, expectedVersion);
    }
    return response;
  }

  /**
   * Loads model from store - reduced to current state
   * @param reducer model reducer
   * @param callback optional reduction predicate
   * @returns loaded model
   */
  async load<M extends Payload, E>(
    reducer: ModelReducer<M, E>,
    callback?: (event: EvtOf<E>, state: M) => void
  ): Promise<Snapshot<M>> {
    const log: Snapshot<M> = {
      event: undefined,
      state: reducer.init()
    };
    let count = 0;
    await this.store.load<E>(aggregateId(reducer), (event) => {
      log.event = event;
      log.state = apply(reducer, event, log.state);
      count++;
      if (callback) callback(event, log.state);
    });
    this.log.trace("gray", `   ... loaded ${count} event(s)`);
    return log;
  }

  /**
   * Loads model stream from store
   * @param reducer model reducer
   * @returns stream log with events and state transitions
   */
  async stream<M extends Payload, E>(
    reducer: ModelReducer<M, E>
  ): Promise<Snapshot<M>[]> {
    const log: Snapshot<M>[] = [];
    await this.load(reducer, (event, state) =>
      log.push({ event, state: state })
    );
    return log;
  }
}
