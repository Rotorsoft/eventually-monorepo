import { Builder } from "./builder";
import { Broker, Store } from "./interfaces";
import { log } from "./log";
import { singleton } from "./singleton";
import {
  Aggregate,
  AllQuery,
  MessageFactory,
  CommandResponse,
  Evt,
  EvtOf,
  ExternalSystem,
  Getter,
  Message,
  MessageHandler,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  Reducible,
  Snapshot
} from "./types";
import { getReducible, getStreamable } from "./utils";
import { InMemoryBroker, InMemoryStore } from "./__dev__";

export const store = singleton(function store(store?: Store) {
  return store || InMemoryStore();
});

export const broker = singleton(function broker(broker?: Broker) {
  return broker || InMemoryBroker();
});

interface Reader {
  load: Getter;
  stream: Getter;
}

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase extends Builder implements Reader {
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
   * Handles reducible storage
   * @param handler the message handler
   * @param callback the concrete message handling
   * @param expectedVersion optional reducible expected version
   * @param publishCallback optional callback to publish events with "at-least-once" delivery guarantees
   * @returns the reduced snapshots
   */
  private async _handle<M extends Payload, C, E>(
    handler: MessageHandler<M, C, E>,
    callback: (state: M) => Promise<Message<keyof E & string, Payload>[]>,
    expectedVersion?: number,
    publishCallback?: (events: Evt[]) => Promise<void>
  ): Promise<Snapshot<M>[]> {
    const streamable = getStreamable(handler);
    const reducible = getReducible(handler);
    let { state, count } = reducible // eslint-disable-line prefer-const
      ? await this.load(reducible)
      : { state: undefined, count: 0 };
    const events = await callback(state);
    if (streamable) {
      const committed = await store().commit(
        streamable.stream(),
        events,
        expectedVersion,
        publishCallback
      );
      if (reducible) {
        const snapshots = committed.map((event) => {
          this.log.trace(
            "gray",
            `   ... committed ${event.name} @ ${event.version} - `,
            event.data
          );
          state = (reducible as any)["apply".concat(event.name)](state, event);
          this.log.trace("gray", `   === @ ${event.version}`, state);
          return { event, state };
        });

        if (count > reducible.snapshot?.threshold) {
          await this.getSnapshotStore(reducible).upsert(
            streamable.stream(),
            snapshots[snapshots.length - 1]
          );
        }

        return snapshots;
      } else {
        return committed.map((event) => ({ event }));
      }
    }
    return [{ event: undefined }];
  }

  /**
   * Initializes application store and subscribes policy handlers to public event topics
   * Concrete implementations provide the listening framework
   */
  async listen(): Promise<void> {
    await store().init();
    await Promise.all(Object.values(this._snapshotStores).map((s) => s.init()));
    await Promise.all(
      Object.values(this._handlers.events)
        .filter(({ event }) => event().scope() === "public")
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
    await Promise.all(
      Object.values(this._snapshotStores).map((s) => s.close())
    );
  }

  /**
   * Handles commands
   * @param handler the aggregate or system with command handlers
   * @param command the command factory
   * @param data the payload
   * @param expectedVersion optional aggregate expected version to allow optimistic concurrency
   * @returns array of snapshots produced by this command
   */
  async command<M extends Payload, C, E>(
    handler: Aggregate<M, C, E> | ExternalSystem<C, E>,
    command: MessageFactory,
    data?: Payload,
    expectedVersion?: number
  ): Promise<Snapshot<M>[]> {
    this.log.trace(
      "blue",
      `\n>>> ${command.name} ${handler.stream()} ${
        expectedVersion ? ` @${expectedVersion}` : ""
      }`,
      data
    );
    return await this._handle(
      handler,
      (state: M) => (handler as any)["on".concat(command.name)](data, state),
      expectedVersion,
      this._publish.bind(this)
    );
  }

  /**
   * Handles policy events and optionally invokes command on target aggregate - side effect
   * @param factory the event handler factory
   * @param event the triggering event
   * @returns command response and optional state
   */
  async event<E, M extends Payload>(
    factory: PolicyFactory<E> | ProcessManagerFactory<M, E>,
    event: EvtOf<E>
  ): Promise<{ response: CommandResponse | undefined; state?: M }> {
    this.log.trace(
      "magenta",
      `\n>>> ${event.name} ${factory.name}`,
      event.data
    );
    const handler = factory(event);
    let response: CommandResponse | undefined;
    const [{ state }] = await this._handle(handler, async (state: M) => {
      response = await (handler as any)["on".concat(event.name)](event, state);
      if (response) {
        // handle commands synchronously
        const { id, command, data, expectedVersion } = response;
        const { factory } = this._handlers.commands[command.name];
        await this.command(factory(id), command, data, expectedVersion);
      }
      return [event as Evt];
    });
    return { response, state };
  }

  /**
   * Loads current model state
   * @param reducible a reducible artifact
   * @param useSnapshots flag to use snapshot store
   * @param callback optional reduction predicate
   * @param noSnapshots boolean flag to load the stream without snapshost
   * @returns current model state
   */
  async load<M extends Payload>(
    reducible: Reducible<M, unknown>,
    useSnapshots = true,
    callback?: (snapshot: Snapshot<M>) => void
  ): Promise<Snapshot<M> & { count: number }> {
    const snapshot =
      useSnapshots &&
      reducible.snapshot &&
      (await this.getSnapshotStore(reducible).read<M>(reducible.stream()));
    let state = snapshot?.state || reducible.init();
    let event = snapshot?.event;
    let count = 0;

    await store().query(
      (e) => {
        event = e;
        state = (reducible as any)["apply".concat(e.name)](state, e);
        count++;
        if (callback) callback({ event, state });
      },
      { stream: reducible.stream(), after: event?.id }
    );

    this.log.trace(
      "gray",
      `   ... ${reducible.stream()} loaded ${count} event(s)`
    );

    return { event, state, count };
  }

  /**
   * Loads stream
   * @param reducible a reducible artifact
   * @param useSnapshots flag to use snapshot store
   * @returns stream log with events and state transitions
   */
  async stream<M extends Payload, E>(
    reducible: Reducible<M, E>,
    useSnapshots = false
  ): Promise<Snapshot<M>[]> {
    const log: Snapshot<M>[] = [];
    await this.load(reducible, useSnapshots, (snapshot) => log.push(snapshot));
    return log;
  }

  /**
   * Queries the store - all streams
   * @param query optional query parameters
   */
  async query(query: AllQuery = { after: -1, limit: 1 }): Promise<Evt[]> {
    const events: Evt[] = [];
    await store().query((e) => events.push(e), query);
    return events;
  }
}
