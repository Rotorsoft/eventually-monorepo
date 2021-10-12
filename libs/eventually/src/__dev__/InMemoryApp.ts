import { AppBase } from "../app";
import { config } from "../config";
import {
  Aggregate,
  CommandResponse,
  EvtOf,
  ExternalSystem,
  MsgOf,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  Snapshot
} from "../types";
import { committedSchema, ValidationError } from "../utils";

const validate = <T>(message: MsgOf<T>, committed = false): void => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { scope, schema, ...value } = message;
  const validator = committed ? committedSchema(schema()) : schema();
  const { error } = validator.validate(value, { abortEarly: false });
  if (error) throw new ValidationError(error);
};

export class InMemoryApp extends AppBase {
  async listen(): Promise<void> {
    await super.listen();
    this.log.info("white", "InMemory app is listening...", undefined, config);
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
    factory: PolicyFactory<C, E> | ProcessManagerFactory<M, C, E>,
    event: EvtOf<E>
  ): Promise<{ response: CommandResponse<C> | undefined; state?: M }> {
    validate(event as unknown as MsgOf<E>, true);
    return super.event(factory, event);
  }
}
