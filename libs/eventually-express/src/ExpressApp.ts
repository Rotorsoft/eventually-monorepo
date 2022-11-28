import {
  AppBase,
  CommandAdapterFactory,
  config,
  decamelize,
  EventHandlerFactory,
  ReducibleFactory
} from "@rotorsoft/eventually";
import cors from "cors";
import express, { RequestHandler, Router, urlencoded } from "express";
import { Server } from "http";
import { OpenAPIObject } from "openapi3-ts";
import {
  allStreamHandler,
  commandHandler,
  errorHandler,
  eventHandler,
  getHandler,
  invokeHandler,
  snapshotQueryHandler,
  statsHandler
} from "./handlers";
import { openAPI } from "./openapi";
import { home, redoc } from "./openapi/docs";
import { httpGetPath, httpPostPath } from "./openapi/utils";

export class ExpressApp extends AppBase {
  private _app = express();
  private _router = Router();
  private _server: Server | undefined;
  private _oas: OpenAPIObject | undefined;

  private _withStreams(): void {
    this._router.get("/all", allStreamHandler);
    this.log.info(
      "bgGreen",
      " GET ",
      "/all?[stream=...][&names=...][&after=-1][&limit=1][&before=...][&created_after=...][&created_before=...]"
    );
    this._router.get("/stats", statsHandler);
    this.log.info("bgGreen", " GET ", "/stats");
  }

  private _withGets(factory: ReducibleFactory): void {
    const path = httpGetPath(factory.name);
    this._router.get(path, getHandler(factory, this.load.bind(this)));
    this.log.info("bgGreen", " GET ", path);

    const streamPath = path.concat("/stream");
    this._router.get(streamPath, getHandler(factory, this.stream.bind(this)));
    this.log.info("bgGreen", " GET ", streamPath);

    const snapOpts = this._snapshotOptions[factory.name];
    if (snapOpts && snapOpts.expose) {
      const path = `/${decamelize(factory.name)}`;
      this._router.get(path, snapshotQueryHandler(snapOpts.store));
      this.log.info("bgGreen", " GET ", path);
    }
  }

  private _withPosts(): void {
    Object.values(this.artifacts).forEach(({ type, factory, inputs }) => {
      (type === "aggregate" || type === "process-manager") &&
        this._withGets(factory as ReducibleFactory);
      if (type === "policy" || type === "process-manager") {
        const path = httpPostPath(factory.name, type);
        this._router.post(path, eventHandler(factory as EventHandlerFactory));
        this.log.info("bgMagenta", " POST ", path, inputs);
      } else
        Object.values(inputs).forEach((message) => {
          const path = httpPostPath(factory.name, type, message);
          if (type === "command-adapter")
            this._router.post(
              path,
              invokeHandler(factory as CommandAdapterFactory)
            );
          else
            this._router.post(
              path,
              commandHandler(message, type === "aggregate")
            );
          this.log.info("bgBlue", " POST ", path);
        });
    });
  }

  build(middleware?: RequestHandler[]): express.Express {
    const { service, version, dependencies } = config();

    super.build();
    this._oas = openAPI();
    this._withPosts();
    this.hasStreams && this._withStreams();

    this._app.set("trust proxy", true);
    this._app.use(cors());
    this._app.use(urlencoded({ extended: false }));
    this._app.use(express.json());
    middleware && this._app.use(middleware);
    this._app.use(this._router);

    // openapi
    this._app.get("/swagger", (_, res) => res.json(this._oas));
    this._app.get("/_redoc", (_, res) => res.type("html").send(redoc(service)));

    this._app.get("/_config", (_, res) =>
      res.json({
        service,
        version,
        dependencies,
        artifacts: this.artifacts,
        messages: Object.values(this.messages).map(
          ({ name, type, schema, handlers }) => ({
            name,
            type,
            description: schema.description || "",
            handlers
          })
        )
      })
    );
    this._app.get("/_health", (_, res) =>
      res.status(200).json({ status: "OK", date: new Date().toISOString() })
    );
    this._app.get("/__killme", () => {
      this.log.info("red", "KILLME");
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
    const { service, version, env, logLevel } = config();
    port = port || config().port;

    this._app.get("/", (_, res) => res.type("html").send(home()));
    this._app.use(errorHandler); // ensure catch-all is last handler

    const _config = { env, port, logLevel, service, version };
    if (silent) this.log.info("white", "Config", undefined, _config);
    else
      this._server = await new Promise((resolve) => {
        const server = this._app.listen(port, () => {
          this.log.info(
            "white",
            "Express app is listening",
            undefined,
            _config
          );
          resolve(server);
        });
      });
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
