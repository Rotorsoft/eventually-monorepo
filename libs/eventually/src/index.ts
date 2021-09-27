import { AppBase } from "./AppBase";
import { AggregateFactory, MsgOf, Payload, Snapshot } from "./types";
import { committedSchema } from "./utils";
import { InMemoryApp } from "./__dev__";

export * from "./AppBase";
export * from "./Broker";
export * from "./config";
export * from "./Store";
export * from "./types";
export * from "./utils";
export * from "./__dev__";

let app: AppBase | undefined;
export const App = (base?: AppBase): AppBase => {
  if (!app) app = base || new InMemoryApp();
  return app;
};

const validate = <C>(message: MsgOf<C>, committed = false): void => {
  const { schema, ...value } = message;
  const validator = committed ? committedSchema(schema()) : schema();
  const { error } = validator.validate(value, { abortEarly: false });
  if (error) throw Error(error.toString());
};

export const test_command = async <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>,
  id: string,
  command: MsgOf<C>
): Promise<Snapshot<M>> => {
  validate(command);
  const [, committed] = await App().command(factory, id, command);
  validate(committed as unknown as MsgOf<C>, true);
  return await App().load(factory, id);
};
