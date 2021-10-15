import * as joi from "joi";
import { MessageFactory } from "..";
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

const validate = <T>(
  message: MsgOf<T>,
  sch: joi.ObjectSchema,
  committed = false
): void => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { scope, schema, ...value } = message;
  const validator = committed ? committedSchema(sch) : sch;
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
    const factories = this._factories;
    const command_schema = (factories.commands as MessageFactory<C>)
      [command.name]()
      .schema();
    validate(command, command_schema);
    const snapshots = await super.command(handler, command, expectedVersion);
    snapshots.map(({ event }) => {
      const event_schema = (factories.events as MessageFactory<E>)
        [(event as EvtOf<E>).name]()
        .schema();
      return validate(event as unknown as MsgOf<E>, event_schema, true);
    });
    return snapshots;
  }

  async event<C, E, M extends Payload>(
    factory: PolicyFactory<C, E> | ProcessManagerFactory<M, C, E>,
    event: EvtOf<E>
  ): Promise<{ response: CommandResponse<C> | undefined; state?: M }> {
    const event_schema = (this._factories.events as MessageFactory<E>)
      [event.name]()
      .schema();
    validate(event as unknown as MsgOf<E>, event_schema, true);
    return super.event(factory, event);
  }
}
