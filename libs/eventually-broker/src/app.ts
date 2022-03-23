import { config, log } from "@rotorsoft/eventually";
import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import { subscriptions } from ".";
import * as routes from "./routes";
import { state } from "./state";

export const app = async (): Promise<void> => {
  const listenerFactory = await subscriptions().init(true);
  const services = await subscriptions().loadServices();
  const subs = await subscriptions().loadSubscriptions();

  await state().init(services, subs);

  const servicesListener = listenerFactory();
  void servicesListener.listen(
    "services",
    new URL("pg://services"), // TODO: abstract url by factory
    ({ operation, id }) => state().refreshService(operation, id)
  );
  const subscriptionsListener = listenerFactory();
  void subscriptionsListener.listen(
    "subscriptions",
    new URL("pg://subscriptions"), // TODO: abstract url by factory
    ({ operation, id }) => state().refreshSubscription(operation, id)
  );

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.resolve(__dirname, "../public")));
  app.engine(
    "hbs",
    engine({
      extname: ".hbs",
      helpers: {
        json: (context: any) => JSON.stringify(context),
        title: () => `${config().description} ${config().version}`
      }
    })
  );
  app.set("view engine", "hbs");
  app.set("views", path.resolve(__dirname, "./views"));
  app.use("/services", routes.services);
  app.use("/", routes.subscriptions);

  app.listen(config().port, () =>
    log().info("bgGreen", `Broker is listening on port ${config().port}`)
  );
};
