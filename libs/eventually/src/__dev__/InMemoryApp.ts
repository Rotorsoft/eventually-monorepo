import { InMemoryBroker, InMemoryStore } from ".";
import { AppBase } from "../AppBase";
import { config } from "../config";
import {
  Aggregate,
  EvtOf,
  MsgOf,
  Payload,
  PolicyFactory,
  PolicyResponse,
  Snapshot
} from "../types";
import { committedSchema, ValidationError } from "../utils";

const validate = <T>(message: MsgOf<T>, committed = false): void => {
  const { schema, ...value } = message;
  const validator = committed ? committedSchema(schema()) : schema();
  const { error } = validator.validate(value, { abortEarly: false });
  if (error) throw new ValidationError(error);
};

export class InMemoryApp extends AppBase {
  listen(): unknown {
    this._store = InMemoryStore();
    this._broker = InMemoryBroker(this);
    void this.connect().then(() => {
      this.log.info("white", "InMemory app is listening...", config);
    });
    return;
  }

  async close(): Promise<void> {
    await this._store.close();
  }

  async command<M extends Payload, C, E>(
    aggregate: Aggregate<M, C, E>,
    command: MsgOf<C>,
    expectedVersion?: string
  ): Promise<Snapshot<M>[]> {
    validate(command);
    const snapshots = await super.command(aggregate, command, expectedVersion);
    snapshots.map(({ event }) => validate(event as unknown as MsgOf<E>, true));
    return snapshots;
  }

  async event<C, E, M extends Payload>(
    factory: PolicyFactory<C, E, M>,
    event: EvtOf<E>
  ): Promise<PolicyResponse<C> | undefined> {
    validate(event as unknown as MsgOf<E>, true);
    return super.event(factory, event);
  }
}
