import { AppBase } from "./AppBase";
import { Aggregate, MsgOf, Payload, Snapshot } from "./types";
import { committedSchema } from "./utils";
import { InMemoryApp, InMemoryBroker, InMemoryStore } from "./__dev__";

export * from "./AppBase";
export * from "./Broker";
export * from "./config";
export * from "./Store";
export * from "./types";
export * from "./utils";

let app: AppBase | undefined;
export const App = (base?: AppBase): AppBase => {
  if (!app) app = base || new InMemoryApp(InMemoryStore(), InMemoryBroker());
  return app;
};

const validate = <C>(message: MsgOf<C>, committed = false): void => {
  const { schema, ...value } = message;
  const validator = committed ? committedSchema(schema()) : schema();
  const { error } = validator.validate(value);
  if (error) throw Error(error.toString());
};

export const test_command = async <M extends Payload, C, E>(
  aggregate: Aggregate<M, C, E>,
  command: MsgOf<C>
): Promise<Snapshot<M>> => {
  validate(command);
  const [, committed] = await App().command(aggregate, command);
  validate(committed as unknown as MsgOf<C>, true);
  return await App().load(aggregate);
};
