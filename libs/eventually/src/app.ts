import { Builder } from "./builder";
import { Broker, Store } from "./interfaces";
import { log } from "./log";
import { singleton } from "./singleton";
import {
  AllQuery,
  Command,
  CommandHandlerFactory,
  CommittedEvent,
  EventHandlerFactory,
  Getter,
  Message,
  MessageHandler,
  Payload,
  PolicyFactory,
  Reducible,
  Scopes,
  Snapshot
} from "./types";
import { bind, getReducible, getStreamable } from "./utils";
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
  private async _publish<C, E>(
    events: CommittedEvent<keyof E & string, Payload>[]
  ): Promise<void> {
    // private subscriptions are invoked synchronously (in-process)
    await Promise.all(
      events.map((e) => {
        const private_sub = this._private_subscriptions[e.name];
        if (private_sub) {
          return Promise.all(
            private_sub.map((f: PolicyFactory<C, E>) => this.event(f, e))
          );
        }
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
    callback: (state: M) => Promise<Message<string, Payload>[]>,
    expectedVersion?: number,
    publishCallback?: (
      events: CommittedEvent<keyof E & string, Payload>[]
    ) => Promise<void>
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

        count > reducible.snapshot?.threshold &&
          (await this.getSnapshotStore(reducible).upsert(
            streamable.stream(),
            snapshots[snapshots.length - 1]
          ));

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
        .filter(({ path }) => path)
        .map(({ factory, name }) => {
          return broker()
            .subscribe(factory, name)
            .then(() => this.log.info("red", `${factory.name} <<< ${name}`));
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
   * Handles command
   * @param factory the command handler factory
   * @param command the command message
   * @returns array of snapshots produced by this command
   */
  async command<M extends Payload, C, E>(
    factory: CommandHandlerFactory<M, C, E>,
    command: Command<keyof C & string, Payload>
  ): Promise<Snapshot<M>[]> {
    this.log.trace(
      "blue",
      `\n>>> ${factory.name} ${command.name} ${command.id ? command.id : ""} ${
        command.expectedVersion ? `@${command.expectedVersion}` : ""
      }`,
      command.data
    );
    const handler = factory(command.id);
    return await this._handle(
      handler,
      (state: M) =>
        (handler as any)["on".concat(command.name)](command.data, state),
      command.expectedVersion,
      this._publish.bind(this)
    );
  }

  /**
   * Handles event and optionally invokes command on target - side effect
   * @param factory the event handler factory
   * @param event the committed event payload
   * @returns optional command response and reducible state
   */
  async event<M extends Payload, C, E>(
    factory: EventHandlerFactory<M, C, E>,
    event: CommittedEvent<keyof E & string, Payload>
  ): Promise<{
    response: Command<keyof C & string, Payload> | undefined;
    state?: M;
  }> {
    this.log.trace(
      "magenta",
      `\n>>> ${factory.name} ${event.name}`,
      event.data
    );
    const handler = factory(event);
    let response: Command<keyof C & string, Payload> | undefined;
    const [{ state }] = await this._handle(handler, async (state: M) => {
      response = await (handler as any)["on".concat(event.name)](event, state);
      if (response) {
        // handle commands synchronously
        const { factory } = this._handlers.commands[response.name];
        await this.command(factory as CommandHandlerFactory<M, C, E>, response);
      }
      return [bind(event.name, event.data)];
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
        callback && callback({ event, state });
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
  async query(
    query: AllQuery = { after: -1, limit: 1 }
  ): Promise<CommittedEvent<string, Payload>[]> {
    const events: CommittedEvent<string, Payload>[] = [];
    await store().query((e) => events.push(e), query);
    return events;
  }
}
