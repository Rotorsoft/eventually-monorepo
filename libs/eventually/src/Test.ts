import * as joi from "joi";
import { Aggregate, Message, Payload } from "./core";
import { App } from "./index";

const validate = (
  message: Message<string, Payload>,
  committed = false
): void => {
  const { schema, ...value } = message;
  const validator = committed
    ? schema().concat(
        joi.object({
          eventId: joi.number().integer().required(),
          aggregateId: joi.string().required(),
          aggregateVersion: joi.string().required(),
          createdAt: joi.date().required()
        })
      )
    : schema();
  const { error } = validator.validate(value);
  if (error) throw Error(error.toString());
};

export const Test = {
  command: async <Model extends Payload, Commands, Events>(
    aggregate: Aggregate<Model, Commands, Events>,
    command: Message<keyof Commands & string, Payload>
  ): Promise<Model> => {
    validate(command);
    const [, committed] = await App().handle(aggregate, command);
    validate(committed as unknown as Message<string, Payload>, true);
    return await App().load(aggregate);
  }
};
