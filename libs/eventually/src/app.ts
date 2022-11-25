import { Builder } from "./builder";
import { handleMessage, load } from "./handler";
import { Disposable, Store } from "./interfaces";
import { log } from "./log";
import { validate, validateMessage } from "./schema";
import { singleton } from "./singleton";
import { RegistrationError } from "./types/errors";
import {
  CommandAdapterFactory,
  CommandHandlerFactory,
  EventHandlerFactory,
  Reducer,
  ReducibleFactory
} from "./types/factories";
import {
  AllQuery,
  Command,
  CommittedEvent,
  CommittedEventMetadata,
  Message,
  Messages,
  Snapshot,
  State
} from "./types/messages";
import { bind, randomId } from "./utils";
import { InMemoryStore } from "./__dev__";

interface Reader {
  load: Reducer<State, any, any>;
  stream: Reducer<State, any, any>;
}

export const store = singleton(function store(store?: Store) {
  return store || InMemoryStore();
});

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
    P extends State,
    S extends State,
    C extends Messages,
    E extends Messages
  >(
    factory: CommandAdapterFactory<P, C>,
    payload: P
  ): Promise<Snapshot<S, E>[]> {
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
  async command<S extends State, C extends Messages, E extends Messages>(
    command: Command<C>,
    metadata?: CommittedEventMetadata
  ): Promise<Snapshot<S, E>[]> {
    const { actor, name, id, expectedVersion } = command;
    const msg = this.messages[name];
    if (!msg || !msg.artifacts.length)
      throw new RegistrationError(command as Message);
    const factory = this.artifacts[msg.artifacts[0]]
      .factory as unknown as CommandHandlerFactory<S, C, E>;
    if (!factory) throw new RegistrationError(command as Message);

    this.log.trace("blue", `\n>>> ${factory.name}`, command, metadata);
    const { data } = validateMessage(command);
    const artifact = factory(id || "");
    Object.setPrototypeOf(artifact, factory as object);
    return await handleMessage(
      artifact,
      (state) => artifact.on[name](data, state, actor),
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
  async event<S extends State, C extends Messages, E extends Messages>(
    factory: EventHandlerFactory<S, C, E>,
    event: CommittedEvent<E>
  ): Promise<{
    command: Command<C> | undefined;
    state?: S;
  }> {
    const { name, stream, id } = event;
    this.log.trace("magenta", `\n>>> ${factory.name}`, event);
    const artifact = factory(event);
    Object.setPrototypeOf(artifact, factory as object);
    const { data } = validateMessage(event);

    const metadata: CommittedEventMetadata = {
      correlation: event.metadata?.correlation || randomId(),
      causation: { event: { name, stream, id } }
    };
    let command: Command<C> | undefined;
    const snapshots = await handleMessage(
      artifact,
      async (state) => {
        command = await artifact.on[name](event, state);
        // handle commands synchronously
        command && (await this.command<S, C, E>(command, metadata));
        return [bind(name, data)];
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
  async load<S extends State, C extends Messages, E extends Messages>(
    factory: ReducibleFactory<S, C, E>,
    id: string,
    useSnapshots = true,
    callback?: (snapshot: Snapshot<S, E>) => void
  ): Promise<Snapshot<S, E> & { applyCount: number }> {
    const reducible = factory(id);
    Object.setPrototypeOf(reducible, factory as object);
    return load<S, C, E>(reducible, useSnapshots, callback);
  }

  /**
   * Loads stream
   * @param factory the reducible factory
   * @param id the reducible id
   * @param useSnapshots flag to use snapshot store
   * @returns stream log with events and state transitions
   */
  async stream<S extends State, C extends Messages, E extends Messages>(
    factory: ReducibleFactory<S, C, E>,
    id: string,
    useSnapshots = false
  ): Promise<Snapshot<S, E>[]> {
    const log: Snapshot<S, E>[] = [];
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
