import { AppBase } from "./AppBase";
import { config, Environments } from "./config";
import { ExpressApp } from "./routers/ExpressApp";
import { Aggregate, MsgOf, Payload, Snapshot } from "./types";
import { committedSchema } from "./utils";
import { InMemoryApp, InMemoryBroker, InMemoryStore } from "./__dev__";

export * from "./Broker";
export * from "./config";
export * from "./Store";
export * from "./types";
export { commandPath, eventPath } from "./utils";

let app: AppBase | undefined;

export const App = (
  store = InMemoryStore(),
  broker = InMemoryBroker()
): AppBase => {
  if (!app)
    app =
      config.env === Environments.test
        ? new InMemoryApp(InMemoryStore(), InMemoryBroker())
        : new ExpressApp(store, broker);
  return app;
};

const validate = <Commands>(
  message: MsgOf<Commands>,
  committed = false
): void => {
  const { schema, ...value } = message;
  const validator = committed ? committedSchema(schema()) : schema();
  const { error } = validator.validate(value);
  if (error) throw Error(error.toString());
};

export const test_command = async <Model extends Payload, Commands, Events>(
  aggregate: Aggregate<Model, Commands, Events>,
  command: MsgOf<Commands>
): Promise<Snapshot<Model>> => {
  validate(command);
  const [, committed] = await App().command(aggregate, command);
  validate(committed as unknown as MsgOf<Commands>, true);
  return await App().load(aggregate);
};
