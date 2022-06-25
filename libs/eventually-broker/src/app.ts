import { config, dispose, log } from "@rotorsoft/eventually";
import express, { Express, RequestHandler } from "express";
import { engine } from "express-handlebars";
import { Server } from "http";
import path from "path";
import { AppOptions, subscriptions } from ".";
import { state } from "./cluster";
import * as routes from "./routes";
import { formatDate, formatInt } from "./utils";

export const app = async ({
  port,
  middleware = [] as RequestHandler[],
  prerouters,
  serviceLogLinkTemplate
}: AppOptions): Promise<Express> => {
  port = port || config().port;

  await subscriptions().seed();
  const services = await subscriptions().loadServices();

  await state().init(services, { serviceLogLinkTemplate });

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
        dateFormat: (date: Date) => formatDate(date),
        intFormat: (int: number) => formatInt(int),
        inc: (val: number) => val + 1
      }
    })
  );
  app.set("view engine", "hbs");
  app.set("views", path.resolve(__dirname, "./views"));
  prerouters && prerouters.map(({ path, router }) => app.use(path, router));
  app.use("/favicon.ico", (_, res) => {
    res.sendFile(path.resolve(__dirname, "./public/assets/broker.png"));
  });
  app.use("/_services", middleware, routes.services);
  app.use("/_correlation", middleware, routes.correlation);
  app.use("/_contracts", middleware, routes.contracts);
  app.use("/_about", middleware, routes.about);
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
