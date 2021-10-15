import { app, getReducible  } from ".";
import { Builder } from "./builder";
import { Broker, Store, SnapshotStoreFactory, SnapshotStore, SnapshotStoresEnum } from "./interfaces";
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
  ProcessManager,
  ProcessManagerFactory,
  Reducible,
  Snapshot
} from "./types";
import { InMemoryBroker, InMemoryStore, InMemorySnapshotStore } from "./__dev__";

export const store = singleton(function store(store?: Store) {
  return store || InMemoryStore();
});

export const snapshotStores = singleton(function snapshotStores(snapshotStores?: Partial<Record<SnapshotStoresEnum, SnapshotStoreFactory>>) {
  return snapshotStores || new Proxy({} as Record<SnapshotStoresEnum,SnapshotStoreFactory>, {get: () => InMemorySnapshotStore});
});

export const broker = singleton(function broker(broker?: Broker) {
  return broker || InMemoryBroker();
});

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase extends Builder {
  public readonly log = log();
  public readonly snapshotStores = (type: SnapshotStoresEnum, name = 'snapshots'): SnapshotStore =>  snapshotStores()[type](name);

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
    await Promise.all(Object.values(snapshotStores()).map(s=> s().init()));
    await Promise.all(
      Object.values(this._handlers.eventHandlers)
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
    const reducible = getReducible(handler);

    const { state } = reducible
      ? await this.load(reducible)
      : { state: undefined };

    const events: Msg[] = await (handler as any)["on".concat(command.name)](
      command.data,
      state
    );

      const snapshots =  this.commit(
        state, 
        handler,
        events,
        expectedVersion,
        this._publish.bind(this)
      )

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
    const reducible = getReducible(handler);

    const { state } = reducible
      ? await this.load<M>(reducible)
      : { state: undefined };

    const response: CommandResponse<unknown> | undefined = await (
      handler as any
    )["on".concat(event.name)](event, state);

    if (response) {
      // handle commands synchronously
      const { id, command, expectedVersion } = response;
      const { factory } = this._handlers.commandHandlers[command.name];
      this.log.trace(
        "blue",
        `<<< ${command.name} ${factory.name} ${id || ""}`,
        expectedVersion ? ` @${expectedVersion}` : ""
      );
      await this.command(factory(id), command, expectedVersion);
    }

    if (reducible){
      const snapshots = await this.commit<M, C, E>(state, reducible, [event as unknown as Msg]);
      // TODO: Un test que pase por aqui
      Object.assign(state, snapshots && snapshots[snapshots.length-1]?.state || {});
    }

    return { response, state };
  }

  /**
   * Commits message into stream of aggregate id
   * @param stream stream name
   * @param events array of uncommitted events
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @param callback optional callback to handle committed events before closing the transaction
   * @returns array of committed events
   */
  async commit<M extends Payload, C, E>(
    state: M,
    handler: Aggregate<M, C, E> | ExternalSystem<C, E> | ProcessManager<M, C, E>,
    events: Msg[],
    expectedVersion?: number,
    callback?: (events: Evt[]) => Promise<void>
  ): Promise<Snapshot<M>[]> {
    let snapshots;
    
    const committed = await store().commit(
      handler.stream(),
      events,
      expectedVersion,
      callback
    );

    const reducible = getReducible(handler);
    if (reducible){
      snapshots = this._apply(reducible, committed, state)
      try {
        const lastCommittedEvent = committed[committed.length-1];
          lastCommittedEvent.version !== 0 
            //TODO: Would it be better to subtract last commited event id minus last snapshot event id >= threshold?
            && Number(lastCommittedEvent.version) % reducible.snapshot.threshold === 0
            && await reducible.snapshot?.store.upsert(handler.stream(), snapshots[snapshots.length-1])
      } catch (error) {
        app().log.error(error) 
      }
    } else {
      snapshots = committed.map((event) => ({ event }))
    }


    return snapshots;
  }

  /**
   * Loads current model state
   * @param reducer model reducer
   * @param callback optional reduction predicate
   * @param noSnapshots boolean flag to load the stream without snapshost
   * @returns current model state
   */
  async load<M extends Payload>(
    reducer: Reducible<M, unknown>,
    callback?: (snapshot: Snapshot<M>) => void,
    noSnapshots = false
  ): Promise<Snapshot<M>> {
    const snapshot = !noSnapshots && await reducer.snapshot?.store.read<M>(reducer.stream());
    let state = snapshot?.state || reducer.init();
    let event = snapshot?.event;
    // const lastEvent = snapshot?.event;
    let count = 0;
    await store().read(
      (e) => {
        event = e;
        state = (reducer as any)["apply".concat(e.name)](state, e);
        count++;
        if (callback) callback({ event, state });
      },
      { stream: reducer.stream(), after: event?.id }
    );
    this.log.trace(
      "gray",
      `   ... ${reducer.stream()} loaded ${count} event(s)`
    );
    count === 0 && event && callback && callback(snapshot);
    return { event, state };
  }

  /**
   * Loads stream
   * @param reducer model reducer
   * @param useSnapshots boolean flag to load the stream without snapshost
   * @returns stream log with events and state transitions
   */
  async stream<M extends Payload, E>(
    reducer: Reducible<M, E>,
    useSnapshots = false
  ): Promise<Snapshot<M>[]> {
    const log: Snapshot<M>[] = [];
    await this.load(reducer, (snapshot) => log.push(snapshot), !useSnapshots);
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
