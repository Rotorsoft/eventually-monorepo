import { AppBase } from "../app";
import { config } from "../config";
import {
  Aggregate,
  MessageFactory,
  CommandResponse,
  EvtOf,
  ExternalSystem,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  Snapshot
} from "../types";
import { ValidationError } from "../utils";

const validate = (data: Payload, msg: MessageFactory): void => {
  if (msg().schema) {
    const { error } = msg().schema().validate(data, { abortEarly: false });
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
    command: MessageFactory,
    data?: Payload,
    expectedVersion?: number
  ): Promise<Snapshot<M>[]> {
    const factories = this._factories;
    validate(data, factories.commands[command.name]);
    const snapshots = await super.command(
      handler,
      command,
      data,
      expectedVersion
    );
    snapshots.map(({ event }) => {
      return validate(event.data, factories.events[event.name]);
    });
    return snapshots;
  }

  async event<E, M extends Payload>(
    factory: PolicyFactory<E> | ProcessManagerFactory<M, E>,
    event: EvtOf<E>
  ): Promise<{ response: CommandResponse | undefined; state?: M }> {
    validate(event.data, this._factories.events[event.name]);
    return super.event(factory, event);
  }
}
