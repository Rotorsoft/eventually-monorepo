import {
  Aggregate,
  CommittedEvent,
  decamelize,
  Message,
  MessageFactory,
  ModelReducer,
  Payload
} from "./core";
import { Log, LogFactory } from "./log";
import { Store } from "./Store";

export type LogEntry<Model extends Payload> = {
  event: CommittedEvent<string, Payload>;
  state: Model;
};

/**
 * App abstraction implementing generic command handlers
 */
export abstract class AppBase {
  public readonly log: Log = LogFactory();

  constructor(public readonly store: Store) {}

  abstract use<Model extends Payload, Commands, Events>(
    aggregate: (id: string) => Aggregate<Model, Commands, Events>,
    factory: MessageFactory<Commands>
  ): void;

  abstract listen(): void;

  protected register(command: string, path: string): void {
    this.log.trace("blue", `[POST ${command}]`, path);
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

  async handle<Model extends Payload, Commands, Events>(
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
      `   ... committed ${committed.name} @ ${committed.aggregateVersion} - `,
      committed.data
    );

    state = this._apply(aggregate, committed, state);
    this.log.trace("gray", "   === state", state);

    // TODO - signal broker to pull

    return [state, committed as CommittedEvent<keyof Events & string, Payload>];
  }
}
