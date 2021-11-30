import { CommittedEventMetadata } from ".";
import { Builder } from "./builder";
import { config } from "./config";
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
  Reducible,
  Scopes,
  Snapshot
} from "./types";
import {
  bind,
  eventHandlerPath,
  getReducible,
  getStreamable,
  ValidationError
} from "./utils";
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
   * Validates message payloads
   */
  private _validate(message: Message<string, Payload>): void {
    const meta = this.messages[message.name];
    if (!meta)
      throw Error(
        `Message metadata not found. Please register "${message.name}" with the application builder`
      );

    const schema = meta.options.schema;
    if (schema) {
      const { error } = schema.validate(message.data, { abortEarly: false });
      if (error) throw new ValidationError(error);
    }
  }

  /**
   * Publishes committed events inside commit transaction to ensure "at-least-once" delivery
   * - Private events are executed synchronously (in-process)
   * - Public events are delegated to the broker to be published
   * @param events the events about to commit
   */
  private async _publish<C, E>(
    events: CommittedEvent<keyof E & string, Payload>[]
  ): Promise<void> {
    const published = await Promise.all(
      events.map(async (e) => {
        const msg = this.messages[e.name];
        if (msg.options.scope === Scopes.private) {
          // private events are invoked synchronously (in-process)
          await Promise.all(
            Object.values(msg.eventHandlerFactories).map(
              (factory: EventHandlerFactory<Payload, C, E>) =>
                this.event(factory, e)
            )
          );
          return `[${e.name}]`;
        } else {
          // public events are published by the broker
          return broker().publish(e, this._getTopic(msg));
        }
      })
    );
    published.length && this.log.trace("red", "Published", published);
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
    metadata: CommittedEventMetadata,
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
    events.map((event) => this._validate(event));
    if (streamable) {
      const committed = await store().commit(
        streamable.stream(),
        events,
        metadata,
        expectedVersion,
        publishCallback
      );
      if (reducible) {
        const snapshots = committed.map((event) => {
          this.log.trace(
            "gray",
            `   ... ${streamable.stream()} committed ${event.name} @ ${
              event.version
            }`,
            event.data
          );
          state = (reducible as any)["apply".concat(event.name)](state, event);
          this.log.trace(
            "gray",
            `   === ${JSON.stringify(state)}`,
            ` @ ${event.version}`
          );
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
   * Initializes application store and subscribes event handler endpoints
   * Concrete implementations provide the listening framework
   */
  async listen(): Promise<void> {
    await store().init();
    await Promise.all(Object.values(this._snapshotStores).map((s) => s.init()));
    await Promise.all(
      Object.values(this.endpoints.eventHandlers).map(({ factory, topics }) => {
        return Object.values(topics).map((topic) => {
          const url = `${config().host}${eventHandlerPath(factory)}`;
          const sub = `${topic.name}-${config().service}.${factory.name}`;
          return broker()
            .subscribe(sub, url, topic)
            .then(() => this.log.info("red", `${sub} >>> ${url}`));
        });
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
   * @param command command message
   * @param metadata optional metadata to track causation
   * @returns array of snapshots produced by this command
   */
  async command<M extends Payload, C, E>(
    command: Command<keyof C & string, Payload>,
    metadata?: CommittedEventMetadata
  ): Promise<Snapshot<M>[]> {
    const { name, id, expectedVersion, data } = command;
    const msg = this.messages[name];
    if (!msg || !msg.commandHandlerFactory)
      throw Error(`Invalid command "${name}"`);

    const factory = msg.commandHandlerFactory as CommandHandlerFactory<M, C, E>;
    this.log.trace(
      "blue",
      `\n>>> ${factory.name} ${name} ${id || ""} 
    ${expectedVersion ? `@${expectedVersion}` : ""}`,
      data
    );

    this._validate(command);
    const handler = factory(id);
    const meta: CommittedEventMetadata = metadata || { causation: {} };
    meta.causation.command = { name, id, expectedVersion };
    return await this._handle(
      handler,
      (state: M) => (handler as any)["on".concat(name)](data, state),
      meta,
      expectedVersion,
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
    command: Command<keyof C & string, Payload> | undefined;
    state?: M;
  }> {
    const { name, stream, id, data } = event;
    this.log.trace(
      "magenta",
      `\n>>> ${factory.name} ${stream} ${name} ${id}`,
      data
    );

    this._validate(event);
    const handler = factory(event);
    const meta: CommittedEventMetadata = {
      causation: { event: { name, stream, id } }
    };
    let command: Command<keyof C & string, Payload> | undefined;
    const [{ state }] = await this._handle(
      handler,
      async (state: M) => {
        command = await (handler as any)["on".concat(event.name)](event, state);
        // handle commands synchronously
        command && (await this.command<M, C, E>(command, meta));
        return [bind(event.name, event.data)];
      },
      meta
    );
    return { command, state };
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
        const apply = (reducible as any)["apply".concat(e.name)];
        state = apply && apply(state, e);
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
