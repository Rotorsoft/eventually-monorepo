import { AppBase } from "../app";
import { config } from "../config";
import {
  Aggregate,
  EvtOf,
  MsgOf,
  Payload,
  PolicyFactory,
  PolicyResponse,
  Snapshot,
  ExternalSystem
} from "../types";
import { committedSchema, ValidationError } from "../utils";

const validate = <T>(message: MsgOf<T>, committed = false): void => {
  const { schema, ...value } = message;
  const validator = committed ? committedSchema(schema()) : schema();
  const { error } = validator.validate(value, { abortEarly: false });
  if (error) throw new ValidationError(error);
};

export class InMemoryApp extends AppBase {
  async listen(): Promise<void> {
    await super.listen();
    this.log.info("white", "InMemory app is listening...", config);
  }

  async command<M extends Payload, C, E>(
    handler: Aggregate<M, C, E> | ExternalSystem<C, E>,
    command: MsgOf<C>,
    expectedVersion?: number
  ): Promise<Snapshot<M>[]> {
    validate(command);
    const snapshots = await super.command(handler, command, expectedVersion);
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
