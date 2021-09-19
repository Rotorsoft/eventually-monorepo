import { Broker } from "./Broker";
import {
  Aggregate,
  CommandHandler,
  CommittedEvent,
  EventHandler,
  Message,
  MessageFactory,
  ModelReducer,
  Payload,
  Policy,
  PolicyResponse,
  Projector
} from "./core";
import { Log, LogFactory } from "./log";
import { Store } from "./Store";

export type LogEntry<Model extends Payload> = {
  event: CommittedEvent<string, Payload>;
  state: Model;
};

export const decamelize = (key: string): string =>
  key
    .replace(/([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu, "$1-$2")
    .replace(
      /(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu,
      "$1-$2"
    )
    .toLowerCase();

export const handlersOf = <Messages>(
  factory: MessageFactory<Messages>
  // eslint-disable-next-line
): Function[] => {
  // eslint-disable-next-line
  return Object.values<Function>(factory).filter((f: Function) => {
    const message = f();
    return message.name && message.schema;
  });
};

/**
 * Encapsulates underlying infrastructure behind router/broker/store abstractions
 * and implements generic command and event handlers
 */
export abstract class AppBase {
  public readonly log: Log = LogFactory();
  private _command_handlers: Record<
    string,
    { factory: (id: string) => CommandHandler<any, any, any>; path: string }
  > = {};

  constructor(public readonly broker: Broker, public readonly store: Store) {}

  abstract routeAggregate<Model extends Payload, Commands, Events>(
    aggregate: (id: string) => Aggregate<Model, Commands, Events>,
    factory: MessageFactory<Commands>
  ): Promise<void>;

  abstract routePolicy<Commands, Events>(
    policy: () => Policy<Commands, Events>,
    factory: MessageFactory<Events>
  ): Promise<void>;

  abstract routeProjector<Events>(
    projector: () => Projector<Events>,
    factory: MessageFactory<Events>
  ): Promise<void>;

  abstract listen(): void;

  protected register(
    command: string,
    factory: (id: string) => CommandHandler<Payload, unknown, unknown>,
    path: string
  ): void {
    this._command_handlers[command] = { factory, path };
    this.log.trace("blue", `   [POST ${command}]`, path);
  }

  protected async subscribe(
    event: CommittedEvent<string, Payload>,
    factory: () => { name: () => string } & EventHandler<unknown, unknown>,
    path: string
  ): Promise<void> {
    await this.broker.subscribe(event, factory, path);
    this.log.trace("red", `[POST ${event.name}]`, path);
  }

  protected reducerPath<Model extends Payload, Events>(
    factory: (id: string) => ModelReducer<Model, Events>
  ): { name: string; path: string } {
    const name = factory("").name();
    const path = "/".concat(decamelize(name), "/:id");
    return { name, path };
  }

  private _streamId<Model extends Payload, Events>(
    reducer: ModelReducer<Model, Events>
  ): string {
    return `${reducer.name()}:${reducer.id}`;
  }

  private _apply<Model extends Payload, Events>(
    reducer: ModelReducer<Model, Events>,
    event: CommittedEvent<string, Payload>,
    state: Model
  ): Model {
    return (reducer as any)["apply".concat(event.name)](state, event);
  }

  async load<Model extends Payload, Events>(
    reducer: ModelReducer<Model, Events>,
    callback?: (event: CommittedEvent<string, Payload>, state: Model) => void
  ): Promise<Model> {
    let state = reducer.init();
    let count = 0;
    await this.store.load(this._streamId(reducer), (event) => {
      state = this._apply(reducer, event, state);
      count++;
      if (callback) callback(event, state);
    });
    this.log.trace("gray", `   ... loaded ${count} event(s)`);
    return state;
  }

  async stream<Model extends Payload, Events>(
    reducer: ModelReducer<Model, Events>
  ): Promise<LogEntry<Model>[]> {
    const log: LogEntry<Model>[] = [];
    await this.load(reducer, (event, state) =>
      log.push({ event, state: state })
    );
    return log;
  }

  async handleCommand<Model extends Payload, Commands, Events>(
    aggregate: Aggregate<Model, Commands, Events>,
    command: Message<keyof Commands & string, Payload>,
    expectedVersion?: string
  ): Promise<[Model, CommittedEvent<keyof Events & string, Payload>]> {
    this.log.trace(
      "blue",
      `\n>>> ${command.name} ${this._streamId(aggregate)}`,
      command
    );

    let state = await this.load(aggregate);
    if (!state) throw Error(`Invalid aggregate ${aggregate.name}!`);

    const event: Message<keyof Events & string, Payload> = await (
      aggregate as any
    )["on".concat(command.name)](state, command.data);

    const committed = await this.store.commit(
      this._streamId(aggregate),
      event,
      expectedVersion
    );
    this.log.trace(
      "gray",
      `   ... committed ${committed.name} @ ${committed.version} - `,
      committed.data
    );

    state = this._apply(aggregate, committed, state);
    this.log.trace("gray", "   === state", state);

    // TODO - signal broker to pull
    await this.broker.emit(committed);

    return [state, committed as CommittedEvent<keyof Events & string, Payload>];
  }

  async handleEvent<Commands, Events>(
    policy: Policy<Commands, Events>,
    event: CommittedEvent<keyof Events & string, Payload>
  ): Promise<PolicyResponse<Commands> | undefined> {
    this.log.trace("magenta", `\n>>> ${event.name} ${policy.name()}`, event);

    const response: PolicyResponse<Commands> | undefined = await (
      policy as any
    )["on".concat(event.name)](event);

    if (response) {
      const { id, command, expectedVersion } = response;
      const { factory, path } = this._command_handlers[command.name] || {};
      this.log.trace(
        "blue",
        `<<< ${command.name}`,
        `${path} @ ${expectedVersion}`
      );
      if (factory && path)
        await this.broker.send(command, factory, path, id, expectedVersion);
    }

    return response;
  }

  async handleProjection<Events>(
    projector: Projector<Events>,
    event: CommittedEvent<keyof Events & string, Payload>
  ): Promise<void> {
    this.log.trace("green", `\n>>> ${event.name} ${projector.name()}`, event);
    await (projector as any)["on".concat(event.name)](event);
  }
}
