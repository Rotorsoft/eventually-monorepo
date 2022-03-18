import { config, log } from "@rotorsoft/eventually";
import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import { StreamListenerFactory, subscriptions } from ".";
import { routes } from "./routes";
import { fork } from "./utils";

export const app = async (
  subscriptionsListenerFactory: StreamListenerFactory
): Promise<void> => {
  await subscriptions().init(true);
  const args = await subscriptions().load();
  const refresh = fork(args);

  const listener = subscriptionsListenerFactory();
  void listener.listen(
    "broker",
    new URL("pg://subscriptions"),
    async ({ operation, id }) => {
      const [arg] = await subscriptions().load(id);
      refresh(operation, id, arg);
    }
  );

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.engine(
    "hbs",
    engine({
      extname: ".hbs",
      helpers: {
        json: (context: any) => JSON.stringify(context)
      }
    })
  );
  app.set("view engine", "hbs");
  app.set("views", path.resolve(__dirname, "./views"));
  app.use(routes());

  app.listen(config().port, () =>
    log().info("bgGreen", `Broker is listening on port ${config().port}`)
  );
};
