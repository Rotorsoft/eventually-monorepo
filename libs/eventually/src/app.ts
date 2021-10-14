import { Builder } from "./builder";
import { Broker, Store } from "./interfaces";
import { log } from "./log";
import { singleton } from "./singleton";
import {
  Aggregate,
  AllQuery,
  CommandResponse,
  Evt,
  EvtOf,
  ExternalSystem,
  Msg,
  MsgOf,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  Reducible,
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

  /**
   * Publishes committed events inside commit transaction to ensure "at-least-once" delivery
   * - Private events are executed synchronously (in-process)
   * - Public events are delegated to the broker to be published
   * @param events the events about to commit
   */
  private async _publish(events: Evt[]): Promise<void> {
    // private subscriptions are invoked synchronously (in-process)
    await Promise.all(
      events.map((e) => {
        const private_sub = this._private_subscriptions[e.name];
        if (private_sub)
          return Promise.all(private_sub.map((f) => this.event(f, e)));
      })
    );
    // public subscriptions are delegated to the broker
    await Promise.all(events.map((e) => broker().publish(e)));
  }

  /**
   * Applies events to model
   * @param reducer model reducer
   * @param events events to apply
   * @param state initial model state
   * @returns snapshots
   */
  private _apply<M extends Payload>(
    reducer: Reducible<M, unknown>,
    events: Evt[],
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
   * Initializes application store and subscribes policy handlers to public event topics
   * Concrete implementations provide the listening framework
   */
  async listen(): Promise<void> {
    await store().init();
    await Promise.all(
      Object.values(this._handlers.events)
        .filter(({ event }) => event.scope() === "public")
        .map(({ factory, event }) => {
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
    const reducible = "init" in handler ? handler : undefined;

    const { state } = reducible
      ? await this.load(reducible)
      : { state: undefined };

    const events: Msg[] = await (handler as any)["on".concat(command.name)](
      command.data,
      state
    );

    const committed = await store().commit(
      handler.stream(),
      events,
      expectedVersion,
      this._publish.bind(this)
    );

    const snapshots = reducible
      ? this._apply(reducible, committed, state)
      : committed.map((event) => ({ event }));

    return snapshots;
  }

  /**
   * Handles policy events and optionally invokes command on target aggregate - side effect
   * @param factory the event handler factory
   * @param event the triggering event
   * @returns command response and optional state
   */
  async event<C, E, M extends Payload>(
    factory: PolicyFactory<C, E> | ProcessManagerFactory<M, C, E>,
    event: EvtOf<E>
  ): Promise<{ response: CommandResponse<C> | undefined; state?: M }> {
    this.log.trace(
      "magenta",
      `\n>>> ${event.name} ${factory.name}`,
      event.data
    );
    const handler = factory(event);
    const reducible = "init" in handler ? handler : undefined;

    const { state } = reducible
      ? await this.load(reducible)
      : { state: undefined };

    const response: CommandResponse<unknown> | undefined = await (
      handler as any
    )["on".concat(event.name)](event, state);

    if (response) {
      // handle commands synchronously
      const { id, command, expectedVersion } = response;
      const { factory } = this._handlers.commands[command.name];
      this.log.trace(
        "blue",
        `<<< ${command.name} ${factory.name} ${id || ""}`,
        expectedVersion ? ` @${expectedVersion}` : ""
      );
      await this.command(factory(id), command, expectedVersion);
    }

    if (reducible) {
      const committed = await store().commit(reducible.stream(), [
        event as unknown as Msg
      ]);
      this._apply(reducible, committed, state);
    }

    return { response, state };
  }

  /**
   * Loads current model state
   * @param reducer model reducer
   * @param callback optional reduction predicate
   * @returns current model state
   */
  async load<M extends Payload>(
    reducer: Reducible<M, unknown>,
    callback?: (snapshot: Snapshot<M>) => void
  ): Promise<Snapshot<M>> {
    let event: Evt;
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
    reducer: Reducible<M, E>
  ): Promise<Snapshot<M>[]> {
    const log: Snapshot<M>[] = [];
    await this.load(reducer, (snapshot) => log.push(snapshot));
    return log;
  }

  /**
   * Reads all stream
   * @param query optional query parameters
   */
  async read(query: AllQuery = { after: -1, limit: 1 }): Promise<Evt[]> {
    const events: Evt[] = [];
    await store().read((e) => events.push(e), query);
    return events;
  }
}
