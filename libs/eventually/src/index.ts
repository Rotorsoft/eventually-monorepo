import * as joi from "joi";
import { AppBase } from "./AppBase";
import { config, Environments } from "./config";
import { ExpressApp } from "./routers/ExpressApp";
import { Store } from "./Store";
import { Aggregate, Message, Payload } from "./types";
import { InMemoryApp, InMemoryStore } from "./__dev__";

export * from "./types";
export * from "./config";
export * from "./Store";

let app: AppBase | undefined;

export const App = (store: Store = InMemoryStore()): AppBase => {
  if (!app)
    app =
      config.env === Environments.test
        ? new InMemoryApp(InMemoryStore())
        : new ExpressApp(store);
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
): Promise<Model> => {
  validate(command);
  const [, committed] = await App().command(aggregate, command);
  validate(committed as unknown as Message<string, Payload>, true);
  return await App().load(aggregate);
};
