import { InMemoryBroker, InMemoryStore } from "./__dev__";
import { Builder, Handlers } from "./builder";
import { Broker, Store } from "./interfaces";
import { log } from "./log";
import {
  Aggregate,
  Evt,
  EvtOf,
  ExternalSystem,
  ModelReducer,
  MsgOf,
  Payload,
  PolicyFactory,
  PolicyResponse,
  Snapshot
} from "./types";

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase extends Builder {
  public readonly log = log();
  protected _handlers: Handlers;
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
   * Builds application
   * @param options options for store and broker
   */
  build(options?: { store?: Store; broker?: Broker }): unknown | undefined {
    this._handlers = super.handlers();
    this._store = options?.store || InMemoryStore();
    this._broker = options?.broker || InMemoryBroker(this);
    return;
  }

  /**
   * Initializes application store and subscribes policy handlers to event topics
   * Concrete implementations provide the listening framework
   */
  async listen(): Promise<void> {
    await this._store.init();
    await Promise.all(
      Object.values(this._handlers.policies).map(({ factory, event }) =>
        this._broker
          .subscribe(factory, event)
          .then(() => this.log.info("red", `${factory.name} <<< ${event.name}`))
      )
    );
  }

  /**
   * Closes the listening app
   */
  async close(): Promise<void> {
    if (this._store) {
      await this._store.close();
      delete this._store;
      delete this._broker;
      delete this._handlers;
    }
  }

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
    expectedVersion?: number
  ): Promise<Snapshot<M>[]> {
    this.log.trace(
      "blue",
      `\n>>> ${command.name} ${handler.stream()}`,
      command.data
    );
    const aggregate = "init" in handler ? handler : undefined;

    const { state } = aggregate
      ? await this.load(aggregate)
      : { state: undefined };

    const events: MsgOf<unknown>[] = await (handler as any)[
      "on".concat(command.name)
    ](command.data, state);

    const committed = await this._store.commit(
      handler.stream(),
      events,
      expectedVersion,
      this._broker
    );

    const snapshots = aggregate
      ? this._apply(aggregate, committed, state)
      : committed.map((event) => ({ event }));

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

    if (response) {
      // ensure "at-least-once" delivery before comitting
      // command handlers must be idempotent
      const { id, command, expectedVersion } = response;
      if (id) {
        this.log.trace(
          "blue",
          `<<< ${command.name} ${id}`,
          `@ ${expectedVersion}`
        );
        const { factory } = this._handlers.aggregates[command.name];
        await this.command(factory(id), command, expectedVersion);
      } else {
        this.log.trace("blue", `<<< ${command.name}`);
        const { factory } = this._handlers.systems[command.name];
        await this.command(factory(), command);
      }
    }

    if (policy.reducer)
      await this._store.commit(policy.reducer.stream(), [
        event as unknown as MsgOf<unknown>
      ]);

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
    await this._store.read(
      (e) => {
        event = e;
        state = (reducer as any)["apply".concat(e.name)](state, e);
        count++;
        if (callback) callback({ event, state });
      },
      { stream: reducer.stream() }
    );
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

  /**
   * Reads all stream
   */
  async read(name?: string, after = -1, limit = 1): Promise<Evt[]> {
    const events: Evt[] = [];
    await this._store.read((e) => events.push(e), { name, after, limit });
    return events;
  }
}
