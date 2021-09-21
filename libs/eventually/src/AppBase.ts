import { Log, LogFactory } from "./log";
import { Store } from "./Store";
import {
  Aggregate,
  AggregateFactory,
  CommittedEvent,
  Message,
  MessageFactory,
  ModelReducer,
  Payload,
  Policy,
  PolicyFactory,
  PolicyResponse
} from "./types";
import { aggregateId, apply } from "./utils";

export type LogEntry<Model extends Payload> = {
  event: CommittedEvent<string, Payload>;
  state: Model;
};

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase {
  public readonly log: Log = LogFactory();
  private _aggregates: {
    [name: string]: AggregateFactory<Payload, unknown, unknown>;
  } = {};
  protected _topics: {
    [name: string]: Policy<unknown, unknown>[];
  } = {};

  constructor(public readonly store: Store) {}

  /**
   * Builds aggregate handlers
   * @param factory aggregate factory
   * @param commands associated command factory
   */
  abstract withAggregate<Model extends Payload, Commands, Events>(
    factory: AggregateFactory<Model, Commands, Events>,
    commands: MessageFactory<Commands>
  ): void;

  /**
   * Builds policy handlers
   * @param factory policy factory
   * @param events associated event factory
   */
  abstract withPolicy<Commands, Events>(
    factory: PolicyFactory<Commands, Events>,
    events: MessageFactory<Events>
  ): void;

  /**
   * Starts listening for messages
   */
  abstract listen(): void;

  /**
   * Registers aggregates invoked by policies
   * @param command command name
   * @param factory aggregate factory
   * @param path command path
   */
  protected register<Model extends Payload, Commands, Events>(
    command: string,
    factory: AggregateFactory<Model, Commands, Events>,
    path: string
  ): void {
    this._aggregates[command] = factory;
    this.log.trace("blue", `[POST ${command}]`, path);
  }

  /**
   * Subscribes event topic
   * @param event the event to subscribe
   * @param factory policy factory
   * @param path event path
   */
  protected subscribe<Commands, Events>(
    event: CommittedEvent<string, Payload>,
    factory: PolicyFactory<Commands, Events>,
    path: string
  ): void {
    (this._topics[event.name] = this._topics[event.name] || []).push(factory());
    this.log.trace("red", `[POST ${event.name}]`, path);
  }

  /**
   * Emits committed events to subscribed policies - handling failures
   * @param event committed event
   */
  protected async emit(event: CommittedEvent<string, Payload>): Promise<void> {
    const topic = this._topics[event.name];
    if (topic) {
      const subscriptions = topic.map((policy) =>
        this.event<any, any>(policy, event)
      );
      await Promise.all(subscriptions);
    }
  }

  /**
   * Handles aggregate commands
   * @param aggregate the aggregate with command handlers
   * @param command the command to handle
   * @param expectedVersion optional aggregate expected version to allow optimistic concurrency
   * @returns tuple with mutated model and committed event
   */
  async command<Model extends Payload, Commands, Events>(
    aggregate: Aggregate<Model, Commands, Events>,
    command: Message<keyof Commands & string, Payload>,
    expectedVersion?: string
  ): Promise<[Model, CommittedEvent<keyof Events & string, Payload>]> {
    const id = aggregateId(aggregate);
    this.log.trace("blue", `\n>>> ${command.name} ${id}`, command.data);

    let state = await this.load<Model, Events>(aggregate);
    if (!state) throw Error(`Invalid aggregate ${aggregate.name}!`);

    const event: Message<keyof Events & string, Payload> = await (
      aggregate as any
    )["on".concat(command.name)](state, command.data);

    const committed = await this.store.commit<Events>(
      id,
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

    await this.emit(committed);
    return [state, committed];
  }

  /**
   * Handles policy events and optionally invokes command on target aggregate - side effect
   * @param policy the policy with event handlers
   * @param event the event to handle
   * @returns policy response
   */
  async event<Commands, Events>(
    policy: Policy<Commands, Events>,
    event: CommittedEvent<keyof Events & string, Payload>
  ): Promise<PolicyResponse<Commands> | undefined> {
    this.log.trace(
      "magenta",
      `\n>>> ${event.name} ${policy.name()}`,
      event.data
    );

    const response: PolicyResponse<Commands> | undefined = await (
      policy as any
    )["on".concat(event.name)](event);

    if (response) {
      const { id, command, expectedVersion } = response;
      const factory = this._aggregates[command.name];
      const aggregate = factory(id) as Aggregate<Payload, Commands, Events>;
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
  async load<Model extends Payload, Events>(
    reducer: ModelReducer<Model, Events>,
    callback?: (
      event: CommittedEvent<keyof Events & string, Payload>,
      state: Model
    ) => void
  ): Promise<Model> {
    let state = reducer.init();
    let count = 0;
    await this.store.load<Events>(aggregateId(reducer), (event) => {
      state = apply(reducer, event, state);
      count++;
      if (callback) callback(event, state);
    });
    this.log.trace("gray", `   ... loaded ${count} event(s)`);
    return state;
  }

  /**
   * Loads model stream from store
   * @param reducer model reducer
   * @returns stream log with events and state transitions
   */
  async stream<Model extends Payload, Events>(
    reducer: ModelReducer<Model, Events>
  ): Promise<LogEntry<Model>[]> {
    const log: LogEntry<Model>[] = [];
    await this.load(reducer, (event, state) =>
      log.push({ event, state: state })
    );
    return log;
  }
}
