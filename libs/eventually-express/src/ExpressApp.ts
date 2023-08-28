import {
  Builder,
  broker,
  dateReviver,
  log,
  type AggregateFactory,
  type CommandAdapterFactory,
  type EventHandlerFactory,
  type ProjectorFactory,
  CommandHandlerFactory
} from "@rotorsoft/eventually";
import {
  config,
  esml,
  home,
  httpGetPath,
  httpPostPath,
  openAPI,
  toJsonSchema
} from "@rotorsoft/eventually-openapi";
import cors, { CorsOptions } from "cors";
import express, { RequestHandler, Router, urlencoded } from "express";
import { Server } from "http";
import {
  queryHandler,
  commandHandler,
  errorHandler,
  eventHandler,
  getHandler,
  getStreamHandler,
  invokeHandler,
  projectHandler,
  readHandler,
  statsHandler,
  subscriptionsHandler
} from "./handlers";

/**
 * Eventually express app builder
 *
 * @remarks Exposes public interface as `express` HTTP endpoints
 */
export class ExpressApp extends Builder {
  private _app = express();
  private _router = Router();
  private _server: Server | undefined;

  constructor() {
    super();
  }

  private _withStreams(): void {
    this._router.get("/all", queryHandler);
    log()
      .green()
      .info(
        "GET ",
        "/all?[stream=...][&names=...][&after=-1][&limit=1][&before=...][&created_after=...][&created_before=...]"
      );
    this._router.get("/_stats", statsHandler);
    log().green().info("GET ", "/_stats");
    this._router.get("/_subscriptions", subscriptionsHandler);
    log().green().info("GET ", "/_subscriptions");
  }

  private _withGets(factory: AggregateFactory): void {
    const path = httpGetPath(factory.name);
    this._router.get(path, getHandler(factory));
    log().green().info("GET ", path);

    const streamPath = path.concat("/stream");
    this._router.get(streamPath, getStreamHandler(factory));
    log().green().info("GET ", streamPath);
  }

  private _withPosts(): void {
    this.artifacts.forEach(({ type, factory, inputs }) => {
      const endpoints = inputs
        .filter((input) => input.scope === "public")
        .map((input) => input.name);
      type === "aggregate" && this._withGets(factory as AggregateFactory);
      if (type === "policy" || type === "process-manager") {
        if (endpoints.length) {
          const path = httpPostPath(factory.name, type);
          this._router.post(path, eventHandler(factory as EventHandlerFactory));
          log().magenta().info("POST", path, endpoints);
        }
      } else if (type === "projector") {
        const projector_factory = factory as ProjectorFactory;
        const projector = projector_factory();
        const path = httpPostPath(factory.name, type);
        if (endpoints.length) {
          // projectors expose a route to handle an array of events
          this._router.post(path, projectHandler(projector_factory));
          log().magenta().info("POST", path, inputs);
        }
        this._router.get(
          path,
          readHandler(projector_factory, projector.schemas.state)
        );
        log().green().info("GET ", path);
      } else
        endpoints.forEach((name) => {
          const path = httpPostPath(factory.name, type, name);
          if (type === "command-adapter")
            this._router.post(
              path,
              invokeHandler(factory as CommandAdapterFactory)
            );
          else
            this._router.post(
              path,
              commandHandler(
                factory as CommandHandlerFactory,
                name,
                type === "aggregate"
              )
            );
          log().blue().info("POST", path);
        });
    });
  }

  build(
    options: {
      cors?: CorsOptions;
      middleware?: RequestHandler[];
      home?: boolean;
    } = { cors: { origin: "*" }, home: true }
  ): express.Express {
    super.build();

    // route artifacts
    this._withPosts();
    this.hasStreams && this._withStreams();

    // add middleware
    this._app.set("trust proxy", true);
    options?.cors && this._app.use(cors(options.cors));
    this._app.use(urlencoded({ extended: false }));
    this._app.use(express.json({ reviver: dateReviver }));
    options?.middleware && this._app.use(options.middleware);

    // add home page with OpenApi spec, model, etc
    if (options?.home) {
      // swagger
      const oas = openAPI();
      this._app.get("/swagger", (_, res) => res.json(oas));

      // esml
      this._app.get("/_esml", (_, res) => res.json(esml()));

      // add command schemas
      this._app.get("/_commands/:name", (req, res) => {
        const name = req.params.name.match(/^[a-zA-Z][a-zA-Z0-9]*$/)?.[0];
        const command = name && this.messages.get(name);
        if (command) res.json(toJsonSchema(command.schema));
        else res.status(404).send(`Command ${name} not found!`);
      });

      // add home page
      this._app.get("/", (_, res) => res.type("html").send(home()));
    }

    // add liveness endpoints
    this._app.get("/_health", (_, res) =>
      res.status(200).json({ status: "OK", date: new Date().toISOString() })
    );
    this._app.get("/__killme", () => {
      log().red().bold().info("KILLME");
      process.exit(0);
    });

    // use artifact routes
    this._app.use(this._router);

    // ensure catch-all is last handler
    this._app.use(errorHandler);

    // log sanitized config
    const { service, version, env, logLevel, oas_ui } = config;
    log().info("config", service, { env, logLevel, version, oas_ui });

    return this._app;
  }

  /**
   * Starts listening for requests
   *
   * WARNING!
   *  - Serverless environments provide their own listening framework
   *  - Use wrappers like serverless-http instead
   *
   * @param port to override port in config
   */
  async listen(port?: number): Promise<void> {
    port = port || config.port;

    this._server = await new Promise((resolve) => {
      const server = this._app.listen(port, () => {
        log()
          .yellow()
          .underlined()
          .info(`Express is listening on port ${port}`);

        // sync pending subscriptions
        void broker().drain();

        resolve(server);
      });
    });
  }

  get name(): string {
    return "ExpressApp";
  }

  async dispose(): Promise<void> {
    await super.dispose();
    if (this._server) {
      await new Promise((resolve, reject) => {
        this._server && this._server.once("close", resolve);
        this._server && this._server.close(reject);
      });
      this._server = undefined;
    }
  }
}
