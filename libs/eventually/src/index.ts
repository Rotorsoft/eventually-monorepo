import * as joi from "joi";
import { AppBase, LogEntry } from "./AppBase";
import { config, Environments } from "./config";
import { ExpressApp } from "./routers/ExpressApp";
import { Aggregate, Message, Payload } from "./types";
import { InMemoryApp, InMemoryBroker, InMemoryStore } from "./__dev__";

export * from "./types";
export * from "./config";
export * from "./Store";
export * from "./Broker";
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

export const test_command = async <Model extends Payload, Commands, Events>(
  aggregate: Aggregate<Model, Commands, Events>,
  command: Message<keyof Commands & string, Payload>
): Promise<LogEntry<Model>> => {
  validate(command);
  const [, committed] = await App().command(aggregate, command);
  validate(committed as unknown as Message<string, Payload>, true);
  return await App().load(aggregate);
};
