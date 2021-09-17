import { config } from "./config";
import { AppBase } from "./engine";
import { Express } from "./routers/Express";
import { InMemoryApp } from "./__dev__/InMemoryApp";
import { InMemoryBus } from "./__dev__/InMemoryBus";
import { InMemoryStore } from "./__dev__/InMemoryStore";
// import { PubSubBus } from "./services/GCP/PubSubBus";
// import { FirestoreStore } from "./services/GCP/FirestoreStore";
import { Aggregate, Bus, Message, Policy, PolicyResponse, Store } from "./core";

export * from "./core";

let app: AppBase | undefined;

const bus = (): Bus =>
  // config.bus === "pubsub"
  // ? PubSubBus()
  // : InMemoryBus(`${config.host}:${config.port}`);
  InMemoryBus(`${config.host}:${config.port}`);

const store = (): Store =>
  // config.store === "firestore"
  // ? FirestoreStore()
  // : InMemoryStore();
  InMemoryStore();

export const App = (): AppBase => {
  if (!app) {
    switch (config.env) {
      case "test": {
        app = new InMemoryApp(InMemoryBus(""), InMemoryStore());
        break;
      }

      default: {
        app = new Express(bus(), store());
      }
    }
  }
  return app;
};

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
