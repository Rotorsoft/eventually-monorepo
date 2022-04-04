import { config, dispose, log } from "@rotorsoft/eventually";
import express from "express";
import { engine } from "express-handlebars";
import { Server } from "http";
import path from "path";
import { subscriptions } from ".";
import { state } from "./cluster";
import * as routes from "./routes";

export const app = async (port?: number): Promise<void> => {
  port = port || config().port;

  await subscriptions().seed();
  const services = await subscriptions().loadServices();

  await state().init(services);

  subscriptions().listen(
    ({ operation, id }) => state().refreshService(operation, id),
    ({ operation, id }) => state().refreshSubscription(operation, id)
  );

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(express.static(path.resolve(__dirname, "./public")));
  app.engine(
    "hbs",
    engine({
      extname: ".hbs",
      helpers: {
        json: (context: any) => JSON.stringify(context),
        title: () => `${config().service} ${config().version}`
      }
    })
  );
  app.set("view engine", "hbs");
  app.set("views", path.resolve(__dirname, "./views"));
  app.use("/_services", routes.services);
  app.use("/", routes.subscriptions);

  const server: Server = await new Promise((resolve) => {
    const server = app.listen(port, () => {
      log().info("bgGreen", `Broker app is listening on port ${port}`);
      resolve(server);
    });
  });

  dispose(() => {
    log().info("bgRed", `[${process.pid}]`, "♻️ app");
    return new Promise((resolve, reject) => {
      server.once("close", resolve);
      server.close(reject);
    });
  });
};
