import { Builder, Handlers } from "./builder";
import { Broker, Store } from "./interfaces";
import { log } from "./log";
import { singleton } from "./singleton";
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
import { InMemoryBroker, InMemoryStore } from "./__dev__";

export const store = singleton(function store(store?: Store) {
  return store || InMemoryStore();
});

export const broker = singleton(function broker(broker?: Broker) {
  return broker || InMemoryBroker();
});

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase extends Builder {
  public readonly log = log();
  protected _handlers: Handlers;
  private _topics: {
    [name: string]: PolicyFactory<unknown, unknown, Payload>[];
  } = {};

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
  build(): unknown | undefined {
    this._handlers = super.handlers();
    return;
  }

  /**
   * Initializes application store and subscribes policy handlers to event topics
   * Concrete implementations provide the listening framework
   */
  async listen(): Promise<void> {
    await store().init();
    await Promise.all(
      Object.values(this._handlers.policies).map(({ factory, event }) => {
        // build local topics
        const topic = (this._topics[event.name] =
          this._topics[event.name] || []);
        topic.push(factory);
        // subscribe remote topics
        return broker()
          .subscribe(factory, event)
          .then(() =>
            this.log.info("red", `${factory.name} <<< ${event.name}`)
          );
      })
    );
  }

  /**
   * Closes the listening app
   */
  async close(): Promise<void> {
    await store().close();
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

    const committed = await store().commit(
      handler.stream(),
      events,
      expectedVersion,
      true
    );

    // publish to local topics after commit
    await Promise.all(
      committed.map((e) => {
        const topic = this._topics[e.name];
        if (topic) return Promise.all(topic.map((f) => this.event(f, e)));
      })
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
      await store().commit(policy.reducer.stream(), [
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
    await store().read(
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
    await store().read((e) => events.push(e), { name, after, limit });
    return events;
  }
}
