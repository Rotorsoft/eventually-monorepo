import { Aggregate, Message, Payload, Policy, PolicyResponse } from "./core";
import { App } from "./App";

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
    const [, committed] = await App().handleCommand(aggregate, command);
    validate(committed as unknown as Message<string, Payload>);
    return await App().load(aggregate);
  },

  event: <Commands, Events>(
    policy: Policy<Commands, Events>,
    event: Message<keyof Events & string, Payload>,
    id: string,
    version: string,
    timestamp: Date = new Date()
  ): Promise<PolicyResponse<Commands> | undefined> => {
    const committed = {
      id,
      version,
      timestamp,
      ...event
    };
    validate(committed as unknown as Message<string, Payload>);
    return App().handleEvent(policy, committed);
  }
};
