import { Aggregate, Message, Policy, PolicyResponse } from "./core";
import { App } from "./App";

const validate = (message: Message<string, any>): void => {
  const { schema, ...value } = message;
  const { error } = schema().validate(value);
  if (error) throw Error(error.toString());
};

export const Test = {
  command: async <Model, Commands, Events>(
    aggregate: Aggregate<Model, Commands, Events>,
    command: Message<string & keyof Commands, any>
  ): Promise<Model> => {
    validate(command);
    const [, committed] = await App().handleCommand(aggregate, command);
    validate(committed as unknown as Message<string, any>);
    return await App().load(aggregate);
  },

  event: <Commands, Events>(
    policy: Policy<Commands, Events>,
    event: Message<string & keyof Events, any>,
    id: string,
    version: string
  ): Promise<PolicyResponse<Commands> | undefined> => {
    const committed = {
      id,
      version,
      ...event
    };
    validate(committed as unknown as Message<string, any>);
    return App().handleEvent(policy, committed);
  }
};
