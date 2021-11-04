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
import { ValidationError } from "../utils";

const validate = <T>(data: T, msg: MsgOf<T>): void => {
  if (msg.schema) {
    const { error } = msg.schema().validate(data, { abortEarly: false });
    if (error) throw new ValidationError(error);
  }
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
    const factories = this._factories;
    validate(command.data, factories.commands[command.name]());
    const snapshots = await super.command(handler, command, expectedVersion);
    snapshots.map(({ event }) => {
      return validate(event.data, factories.events[event.name]());
    });
    return snapshots;
  }

  async event<C, E, M extends Payload>(
    factory: PolicyFactory<C, E> | ProcessManagerFactory<M, C, E>,
    event: EvtOf<E>
  ): Promise<{ response: CommandResponse<C> | undefined; state?: M }> {
    validate(event.data, this._factories.events[event.name]());
    return super.event(factory, event);
  }
}
