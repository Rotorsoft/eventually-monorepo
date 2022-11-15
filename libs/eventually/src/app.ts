import { Builder } from "./builder";
import { handleMessage, load } from "./handler";
import { Disposable } from "./interfaces";
import { log } from "./log";
import { validate, validateMessage } from "./schema";
import {
  AllQuery,
  CommandAdapterFactory,
  CommandHandlerFactory,
  EventHandlerFactory,
  Reducer,
  ReducibleFactory,
  Snapshot
} from "./types/command-side";
import { RegistrationError } from "./types/errors";
import {
  Command,
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Messages,
  Payload
} from "./types/messages";
import { bind, randomId, store } from "./utils";

interface Reader {
  load: Reducer<Payload, any, any>;
  stream: Reducer<Payload, any, any>;
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
   * @param factory adapter factory
   * @param payload message payload
   */
  async invoke<
    P extends Payload,
    M extends Payload,
    C extends Messages,
    E extends Messages
  >(
    factory: CommandAdapterFactory<P, C>,
    payload: P
  ): Promise<Snapshot<M, E>[]> {
    const adapter = factory();
    const data = validate(payload, adapter.schema);
    return this.command(adapter.adapt(data));
  }

  /**
   * Handles command
   * @param command command message
   * @param metadata optional metadata to track causation
   * @returns array of snapshots produced by this command
   */
  async command<M extends Payload, C extends Messages, E extends Messages>(
    command: Command<C>,
    metadata?: CommittedEventMetadata
  ): Promise<Snapshot<M, E>[]> {
    const { actor, name, id, expectedVersion } = command;
    const msg = this.messages[name];
    if (!msg || !msg.commandHandlerFactory)
      throw new RegistrationError(command as Message);

    const factory = msg.commandHandlerFactory as CommandHandlerFactory<M, C, E>;
    this.log.trace("blue", `\n>>> ${factory.name}`, command, metadata);
    const { data } = validateMessage<C>(command);
    const handler = factory(id || "");
    Object.setPrototypeOf(handler, factory as object);
    return await handleMessage(
      handler,
      (state: M) =>
        (handler as any)["on".concat(name as string)](data, state, actor),
      {
        correlation: metadata?.correlation || randomId(),
        causation: {
          ...metadata?.causation,
          command: { actor, name, id, expectedVersion } as Command
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
  async event<M extends Payload, C extends Messages, E extends Messages>(
    factory: EventHandlerFactory<M, C, E>,
    event: CommittedEvent<E>
  ): Promise<{
    command: Command<C> | undefined;
    state?: M;
  }> {
    const { name, stream, id } = event;
    this.log.trace("magenta", `\n>>> ${factory.name}`, event);
    const handler = factory(event);
    Object.setPrototypeOf(handler, factory as object);
    const on = (handler as any)["on".concat(name as string)];
    if (typeof on !== "function")
      throw new RegistrationError(event as unknown as Message);
    const { data } = validateMessage<E>(event);

    const metadata: CommittedEventMetadata = {
      correlation: event.metadata?.correlation || randomId(),
      causation: { event: { name, stream, id } }
    };
    let command: Command<C> | undefined;
    const snapshots = await handleMessage(
      handler,
      async (state: M) => {
        command = await on(event, state);
        // handle commands synchronously
        command && (await this.command<M, C, E>(command, metadata));
        return [bind<E>(name, data)];
      },
      metadata,
      false // dont notify events committed by process managers to avoid loops
    );
    return {
      command,
      state: snapshots.at(-1)?.state
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
  async load<M extends Payload, C extends Messages, E extends Messages>(
    factory: ReducibleFactory<M, C, E>,
    id: string,
    useSnapshots = true,
    callback?: (snapshot: Snapshot<M, E>) => void
  ): Promise<Snapshot<M, E> & { applyCount: number }> {
    const reducible = factory(id);
    Object.setPrototypeOf(reducible, factory as object);
    return load(reducible, useSnapshots, callback);
  }

  /**
   * Loads stream
   * @param factory the reducible factory
   * @param id the reducible id
   * @param useSnapshots flag to use snapshot store
   * @returns stream log with events and state transitions
   */
  async stream<M extends Payload, C extends Messages, E extends Messages>(
    factory: ReducibleFactory<M, C, E>,
    id: string,
    useSnapshots = false
  ): Promise<Snapshot<M, E>[]> {
    const log: Snapshot<M, E>[] = [];
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
  ): Promise<CommittedEvent[]> {
    const events: CommittedEvent[] = [];
    await store().query((e) => events.push(e), query);
    return events;
  }
}
