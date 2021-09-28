import { InMemoryBroker, InMemoryStore } from ".";
import { AppBase } from "../AppBase";
import { config } from "../config";
import {
  AggregateFactory,
  EvtOf,
  Listener,
  MsgOf,
  Payload,
  PolicyFactory,
  PolicyResponse,
  Snapshot
} from "../types";
import { committedSchema } from "../utils";

const validate = <T>(message: MsgOf<T>, committed = false): void => {
  const { schema, ...value } = message;
  const validator = committed ? committedSchema(schema()) : schema();
  const { error } = validator.validate(value, { abortEarly: false });
  if (error) throw Error(error.toString());
};

export class InMemoryApp extends AppBase {
  build(): Listener {
    this._store = InMemoryStore();
    this._broker = InMemoryBroker(this);
    this.prebuild();
    return {};
  }

  async listen(): Promise<void> {
    await this.connect();
    this.log.info("white", "InMemory app is listening...", config);
    return Promise.resolve();
  }

  async command<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    id: string,
    command: MsgOf<C>
  ): Promise<Snapshot<M>[]> {
    validate(command);
    const snapshots = await super.command(factory, id, command);
    snapshots.map(({ event }) => validate(event as unknown as MsgOf<E>, true));
    return snapshots;
  }

  async event<C, E>(
    factory: PolicyFactory<C, E>,
    event: EvtOf<E>
  ): Promise<PolicyResponse<C> | undefined> {
    validate(event as unknown as MsgOf<E>, true);
    return super.event(factory, event);
  }
}
