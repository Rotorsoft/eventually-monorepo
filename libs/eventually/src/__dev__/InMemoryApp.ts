import Joi from "joi";
import { AppBase } from "../app";
import { config } from "../config";
import {
  Command,
  CommittedEvent,
  EventHandlerFactory,
  Message,
  Payload,
  Snapshot
} from "../types";
import { ValidationError } from "../utils";

const validate = (data: Payload, schema?: Joi.ObjectSchema): void => {
  if (schema) {
    const { error } = schema.validate(data, { abortEarly: false });
    if (error) throw new ValidationError(error);
  }
};

export class InMemoryApp extends AppBase {
  async listen(): Promise<void> {
    await super.listen();
    this.log.info("white", "InMemory app is listening...", undefined, config);
  }

  async command<M extends Payload, C, E>(
    command: Command<keyof C & string, Payload>
  ): Promise<Snapshot<M>[]> {
    validate(command.data, this.messages[command.name].options.schema);
    const snapshots = await super.command<M, C, E>(command);
    snapshots.map(({ event }) => {
      return validate(event.data, this.messages[event.name].options.schema);
    });
    return snapshots;
  }

  async event<M extends Payload, C, E>(
    factory: EventHandlerFactory<M, C, E>,
    event: CommittedEvent<keyof E & string, Payload>
  ): Promise<{
    response: Message<keyof C & string, Payload> | undefined;
    state?: M;
  }> {
    validate(event.data, this.messages[event.name].options.schema);
    return super.event(factory, event);
  }
}
