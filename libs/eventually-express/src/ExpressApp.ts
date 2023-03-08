import {
  broker,
  Builder,
  CommandAdapterFactory,
  CommandHandlerFactory,
  dateReviver,
  EventHandlerFactory,
  log,
  ProjectorFactory,
  ReducibleFactory,
  Scope
} from "@rotorsoft/eventually";
import cors from "cors";
import express, { RequestHandler, Router, urlencoded } from "express";
import { Server } from "http";
import { OpenAPIObject } from "openapi3-ts";
import { config } from "./config";
import {
  allStreamHandler,
  commandHandler,
  errorHandler,
  eventHandler,
  getHandler,
  readHandler,
  getStreamHandler,
  invokeHandler,
  projectHandler,
  statsHandler
} from "./handlers";
import { openAPI } from "./openapi";
import { home } from "./openapi/docs";
import { httpGetPath, httpPostPath } from "./openapi/utils";

/**
 * Eventually express app builder
 *
 * @remarks Exposes public interface as `express` HTTP endpoints
 */
export class ExpressApp extends Builder {
  private _app = express();
  private _router = Router();
  private _server: Server | undefined;
  private _oas: OpenAPIObject | undefined;

  constructor() {
    super(config.version);
  }

  private _withStreams(): void {
    this._router.get("/all", allStreamHandler);
    log()
      .green()
      .info(
        "GET ",
        "/all?[stream=...][&names=...][&after=-1][&limit=1][&before=...][&created_after=...][&created_before=...]"
      );
    this._router.get("/stats", statsHandler);
    log().green().info("GET ", "/stats");
  }

  private _withGets(factory: ReducibleFactory): void {
    const path = httpGetPath(factory.name);
    this._router.get(path, getHandler(factory));
    log().green().info("GET ", path);

    const streamPath = path.concat("/stream");
    this._router.get(streamPath, getStreamHandler(factory));
    log().green().info("GET ", streamPath);
  }

  private _withPosts(): void {
    Object.values(this.artifacts).forEach(({ type, factory, inputs }) => {
      const endpoints = inputs
        .filter((input) => input.scope === Scope.public)
        .map((input) => input.name);
      (type === "aggregate" || type === "process-manager") &&
        this._withGets(factory as ReducibleFactory);
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

  build(middleware?: RequestHandler[]): express.Express {
    const { service, version, dependencies } = config;

    super.build();
    this._oas = openAPI();
    this._withPosts();
    this.hasStreams && this._withStreams();

    this._app.set("trust proxy", true);
    this._app.use(cors());
    this._app.use(urlencoded({ extended: false }));
    this._app.use(express.json({ reviver: dateReviver }));
    middleware && this._app.use(middleware);
    this._app.use(this._router);

    this._app.get("/swagger", (_, res) => res.json(this._oas));
    this._app.get("/_config", (_, res) =>
      res.json({
        service,
        version,
        dependencies,
        artifacts: this.artifacts,
        messages: Object.values(this.messages).map(
          ({ name, type, schema, handlers, producer }) => ({
            name,
            type,
            description: schema.description || "",
            handlers,
            producer
          })
        )
      })
    );
    this._app.get("/_health", (_, res) =>
      res.status(200).json({ status: "OK", date: new Date().toISOString() })
    );
    this._app.get("/__killme", () => {
      log().red().bold().info("KILLME");
      process.exit(0);
    });

    return this._app;
  }

  /**
   * Starts listening
   * @param silent flag to skip express listening when using cloud functions
   * @param port to override port in config
   */
  async listen(silent = false, port?: number): Promise<void> {
    const { service, version, env, logLevel, oas_ui } = config;
    port = port || config.port;

    this._app.get("/", (_, res) => res.type("html").send(home()));
    this._app.use(errorHandler); // ensure catch-all is last handler

    const _config = { env, port, logLevel, service, version, oas_ui };
    if (silent) log().info("Config", undefined, _config);
    else
      this._server = await new Promise((resolve) => {
        const server = this._app.listen(port, () => {
          log()
            .yellow()
            .underlined()
            .info("Express app is listening", undefined, _config);
          resolve(server);
        });
      });
    void broker().poll();
  }

  get name(): string {
    return "ExpressApp";
  }

  async dispose(): Promise<void> {
    if (this._server) {
      await new Promise((resolve, reject) => {
        this._server && this._server.once("close", resolve);
        this._server && this._server.close(reject);
      });
      this._server = undefined;
    }
  }
}
