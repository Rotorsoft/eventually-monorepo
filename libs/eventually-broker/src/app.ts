import { config, dispose, log } from "@rotorsoft/eventually";
import express, { Express, RequestHandler } from "express";
import { engine } from "express-handlebars";
import helmet from "helmet";
import { Server } from "http";
import { Socket } from "net";
import path from "path";
import { AppOptions, subscriptions } from ".";
import { state } from "./cluster";
import { hbsHelpers } from "./hbs-helpers";
import * as routes from "./routes";

export const app = async ({
  port,
  middleware = [] as RequestHandler[],
  handlers,
  resolvers,
  serviceLogLinkTemplate,
  secrets
}: AppOptions): Promise<Express> => {
  port = port || config().port;

  await subscriptions().seed();
  const services = await subscriptions().loadServices();

  await state().init(services, {
    resolvers,
    serviceLogLinkTemplate,
    secrets
  });

  subscriptions().listen(
    ({ operation, id }) => state().refreshService(operation, id),
    ({ operation, id }) => state().refreshSubscription(operation, id)
  );

  const app = express();
  handlers && handlers.forEach((handler) => app.use(handler));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "style-src": ["'self'", "https://cdn.jsdelivr.net/npm/"],
          "script-src": [
            "'self'",
            "https://cdn.jsdelivr.net/npm/",
            "https://cdn.skypack.dev/"
          ]
        }
      }
    })
  );

  app.use("/public", express.static(path.resolve(__dirname, "./public")));
  app.use("/favicon.ico", (_, res) => {
    res.sendFile(path.resolve(__dirname, "./public/assets/broker.png"));
  });

  app.engine(
    "hbs",
    engine({
      extname: ".hbs",
      helpers: hbsHelpers
    })
  );
  app.set("view engine", "hbs");
  app.set("views", path.resolve(__dirname, "./views"));

  // apis don't use view middleware
  app.use("/api", routes.api);

  // view routes with optional middleware
  app.use("/about", middleware, routes.about);
  app.use("/command", middleware, routes.command);
  app.use("/contracts", middleware, routes.contracts);
  app.use("/correlations", middleware, routes.correlation);
  app.use("/graph", middleware, routes.graph);
  app.use("/monitor", middleware, routes.monitor);
  app.use("/services", middleware, routes.services);
  app.use("/subscriptions", middleware, routes.subscriptions);
  app.use("/", (_, res) => res.redirect("/subscriptions"));

  const server: Server = await new Promise((resolve) => {
    const server = app.listen(port, () => {
      log().info("bgGreen", `Broker app is listening on port ${port}`);
      resolve(server);
    });
  });

  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
    });
  });

  dispose(() => {
    for (const socket of sockets) {
      socket.destroy();
      sockets.delete(socket);
    }
    return new Promise((resolve, reject) => {
      server.once("close", () => {
        log().info("bgRed", `[${process.pid}]`, "♻️ Broker Express App");
        resolve();
      });
      server.close(reject);
    });
  });

  return app;
};
