import { Builder } from "./builder";
import { handleMessage, load } from "./handler";
import { Disposable } from "./interfaces";
import { log } from "./log";
import {
  AllQuery,
  Command,
  CommandAdapterFactory,
  CommandHandlerFactory,
  CommittedEvent,
  CommittedEventMetadata,
  EventHandlerFactory,
  Getter,
  Payload,
  ReducibleFactory,
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
  abstract dispose(): Promise<void>;
  abstract listen(): Promise<void>;

  /**
   * Invokes command through adapter
   * @param adapter adapter
   * @param message message payload
   */
  async invoke<C, P extends Payload, E>(
    factory: CommandAdapterFactory<C, P>,
    payload: P
  ): Promise<Snapshot<C[keyof C] & Payload>[]> {
    const data = validateMessage({ name: factory.name, data: payload }) as P;
    const command = factory().adapt(data);
    return this.command<C[keyof C] & Payload, C, E>(command);
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
    if (!msg || !msg.commandHandlerFactory)
      throw new RegistrationError(command);

    const factory = msg.commandHandlerFactory as CommandHandlerFactory<M, C, E>;
    this.log.trace("blue", `\n>>> ${factory.name}`, command, metadata);
    const data = validateMessage(command);
    const handler = factory(id);
    Object.setPrototypeOf(handler, factory);
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
    factory: EventHandlerFactory<M, C, E>,
    event: CommittedEvent<keyof E & string, Payload>
  ): Promise<{
    command: Command<keyof C & string, Payload> | undefined;
    state?: M;
  }> {
    const { name, stream, id } = event;
    this.log.trace("magenta", `\n>>> ${factory.name}`, event);
    const handler = factory(event);
    Object.setPrototypeOf(handler, factory);
    const on = (handler as any)["on".concat(name)];
    if (typeof on !== "function") throw new RegistrationError(event);
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
   * @param factory the reducible factory
   * @param id the reducible id
   * @param useSnapshots flag to use snapshot store
   * @param callback optional reduction predicate
   * @returns current model state
   */
  async load<M extends Payload, C, E>(
    factory: ReducibleFactory<M, C, E>,
    id: string,
    useSnapshots = true,
    callback?: (snapshot: Snapshot<M>) => void
  ): Promise<Snapshot<M> & { applyCount: number }> {
    const reducible = factory(id);
    Object.setPrototypeOf(reducible, factory);
    return load(reducible, useSnapshots, callback);
  }

  /**
   * Loads stream
   * @param factory the reducible factory
   * @param id the reducible id
   * @param useSnapshots flag to use snapshot store
   * @returns stream log with events and state transitions
   */
  async stream<M extends Payload, C, E>(
    factory: ReducibleFactory<M, C, E>,
    id: string,
    useSnapshots = false
  ): Promise<Snapshot<M>[]> {
    const log: Snapshot<M>[] = [];
    await this.load(factory, id, useSnapshots, (snapshot) =>
      log.push(snapshot)
    );
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
