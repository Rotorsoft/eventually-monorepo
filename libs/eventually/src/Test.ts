import { Aggregate, Message, Payload } from "./core";
import { App } from "./index";

const validate = (message: Message<string, Payload>): void => {
  const { schema, ...value } = message;
  const { error } = schema().validate(value);
  if (error) throw Error(error.toString());
};

export const Test = {
  command: async <Model extends Payload, Commands, Events>(
    aggregate: Aggregate<Model, Commands, Events>,
    command: Message<keyof Commands & string, Payload>
  ): Promise<Model> => {
    validate(command);
    const [, committed] = await App().handle(aggregate, command);
    validate(committed as unknown as Message<string, Payload>);
    return await App().load(aggregate);
  }
};
