import { Builder } from "./builder";
import { handleMessage } from "./handler";
import { Disposable } from "./interfaces";
import { log } from "./log";
import {
  AllQuery,
  Command,
  CommandHandlerFactory,
  CommittedEvent,
  CommittedEventMetadata,
  CommittedEventWithSource,
  Getter,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  Projection,
  ProjectorFactory,
  Reducible,
  Snapshot
} from "./types";
import {
  bind,
  randomId,
  RegistrationError,
  store,
  validateMessage
} from "./utils";

interface Reader {
  load: Getter;
  stream: Getter;
}

/**
 * App abstraction implementing generic handlers
 */
export abstract class AppBase extends Builder implements Disposable, Reader {
  public readonly log = log();

  /**
   * Concrete implementations should provide disposers and the listening framework
   */
  abstract readonly name: string;
  abstract listen(): Promise<void>;
  async dispose(): Promise<void> {
    await Promise.all(
      Object.values(this._snapshotStores).map((s) => s.dispose())
    );
    await Promise.all(
      Object.values(this._projectionStores).map((s) => s.dispose())
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
    const { actor, name, id, expectedVersion } = command;
    const msg = this.messages[name];
    if (!msg || !msg.commandHandler) throw new RegistrationError(command);

    const factory = msg.commandHandler.factory as CommandHandlerFactory<
      M,
      C,
      E
    >;
    this.log.trace("blue", `\n>>> ${factory.name}`, command, metadata);
    const data = validateMessage(command);
    const handler = factory(id);
    return await handleMessage(
      handler,
      (state: M) => (handler as any)["on".concat(name)](data, state, actor),
      {
        correlation: metadata?.correlation || randomId(),
        causation: {
          ...metadata?.causation,
          command: { actor, name, id, expectedVersion }
          // TODO: flag to include command.data in metadata
        }
      }
    );
  }

  /**
   * Handles event and optionally invokes command on target - side effect
   * @param factory the event handler factory
   * @param event the committed event payload
   * @returns optional command response and reducible state
   */
  async event<M extends Payload, C, E>(
    factory: ProcessManagerFactory<M, C, E> | PolicyFactory<C, E>,
    event: CommittedEvent<keyof E & string, Payload>
  ): Promise<{
    command: Command<keyof C & string, Payload> | undefined;
    state?: M;
  }> {
    const { name, stream, id } = event;
    this.log.trace("magenta", `\n>>> ${factory.name}`, event);
    const handler = factory(event);
    const on = (handler as any)["on".concat(name)];
    if (!on) throw new RegistrationError(event);
    const data = validateMessage(event);

    const metadata: CommittedEventMetadata = {
      correlation: event.metadata?.correlation || randomId(),
      causation: { event: { name, stream, id } }
    };
    let command: Command<keyof C & string, Payload> | undefined;
    const snapshots = await handleMessage(
      handler,
      async (state: M) => {
        command = await on(event, state);
        // handle commands synchronously
        command && (await this.command<M, C, E>(command, metadata));
        return [bind(name, data)];
      },
      metadata,
      false // dont notify events committed by process managers to avoid loops
    );
    return {
      command,
      state: snapshots.length ? snapshots[0].state : undefined
    };
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
      (await this.readSnapshot(reducible));
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

  /**
   * Projects events into projections
   * @param factory the projector factory
   * @param events the events to be projected
   * @returns the projection
   */
  async project<M extends Payload, E>(
    factory: ProjectorFactory<M, E>,
    events: Array<CommittedEventWithSource>
  ): Promise<
    Projection<M> & {
      error?: Error;
    }
  > {
    let projection: Projection<M>;
    try {
      const handler = factory();
      const store = this.getProjectionStore(handler);
      for (const event of events) {
        this.log.trace("magenta", `\n>>> ${factory.name}`, event);
        const on = (handler as any)["on".concat(event.name)];
        if (!on) throw new RegistrationError(event);
        const data = validateMessage(event);
        projection = await store.load(event);
        // TODO: check this generically?
        if ((projection.watermarks[event.source] || -1) < event.id) {
          const state: M = await on(data, projection.state);
          projection = await store.commit(event, state);
        }
      }
      return projection;
    } catch (error) {
      return { ...projection, error };
    }
  }

  /**
   * Reads from projections
   * TODO: filter and pagination options
   * @param factory the projector factory
   */
  async read<M extends Payload, E>(
    factory: ProjectorFactory<M, E>
  ): Promise<Array<Readonly<M>>> {
    const handler = factory();
    const store = this.getProjectionStore(handler);
    return await store.query();
  }
}
