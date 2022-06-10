import { config, dispose, log } from "@rotorsoft/eventually";
import express, { Express, RequestHandler } from "express";
import { engine } from "express-handlebars";
import { Server } from "http";
import path from "path";
import { subscriptions } from ".";
import { state } from "./cluster";
import * as routes from "./routes";

type AppConfig = {
  port?: number;
  middleware?: RequestHandler[];
};

export const app = async ({
  port,
  middleware = []
}: AppConfig): Promise<Express> => {
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
  app.use("/_public", express.static(path.resolve(__dirname, "./public")));
  app.engine(
    "hbs",
    engine({
      extname: ".hbs",
      helpers: {
        json: (context: any) => JSON.stringify(context),
        title: () => config().service,
        version: () => config().version,
        dateFormat: (date: Date) =>
          date.toISOString().substring(0, 19).replace("T", " ")
      }
    })
  );
  app.set("view engine", "hbs");
  app.set("views", path.resolve(__dirname, "./views"));
  app.use("/_services", middleware, routes.services);
  app.use("/_contracts", middleware, routes.contracts);
  app.use("/", middleware, routes.subscriptions);

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

  return app;
};
