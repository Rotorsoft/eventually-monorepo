import { AppBase } from "../app";
import { config } from "../config";
import {
  Aggregate,
  CommittedEvent,
  ExternalSystem,
  Message,
  MessageFactory,
  Payload,
  PolicyFactory,
  ProcessManagerFactory,
  Snapshot
} from "../types";
import { ValidationError } from "../utils";

const validate = (
  data: Payload,
  msg: MessageFactory<string, Payload>
): void => {
  if (msg().schema) {
    const { error } = msg().schema.validate(data, { abortEarly: false });
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
    command: MessageFactory<keyof C & string, Payload>,
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

  async event<M extends Payload, C, E>(
    factory: PolicyFactory<C, E> | ProcessManagerFactory<M, C, E>,
    event: CommittedEvent<keyof E & string, Payload>
  ): Promise<{
    response: Message<keyof C & string, Payload> | undefined;
    state?: M;
  }> {
    validate(event.data, this._factories.events[event.name]);
    return super.event(factory, event);
  }
}
