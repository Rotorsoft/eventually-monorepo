import {
  AggregateFactory,
  AppBase,
  config,
  decamelize,
  Payload,
  ProcessManagerFactory,
  Reducer,
  ReducibleFactory,
  reduciblePath,
  SnapshotStore
} from "@rotorsoft/eventually";
import cors from "cors";
import express, { RequestHandler, Router, urlencoded } from "express";
import { Server } from "http";
import { OpenAPIObject } from "openapi3-ts";
import { home, redoc } from "./docs";
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
import { swagger } from "./swagger";

export class ExpressApp extends AppBase {
  private _app = express();
  private _router = Router();
  private _server: Server | undefined;
  private _swagger: OpenAPIObject | undefined;

  public getSwagger(): OpenAPIObject | undefined {
    return this._swagger;
  }

  private _buildStatsRoute(): void {
    this._router.get("/stats", statsHandler);
    this.log.info("bgGreen", " GET ", "/stats");
  }

  private _buildAllStreamRoute(): void {
    this._router.get("/all", allStreamHandler);
    this.log.info(
      "bgGreen",
      " GET ",
      "/all?[stream=...][&names=...][&after=-1][&limit=1][&before=...][&created_after=...][&created_before=...]"
    );
  }

  private _buildGetters(factory: ReducibleFactory<Payload, any, any>): void {
    const path = reduciblePath(factory);
    this._router.get(
      path,
      getHandler(factory, this.load.bind(this) as Reducer<Payload, any, any>)
    );
    this.log.info("bgGreen", " GET ", path);

    const streamPath = path.concat("/stream");
    this._router.get(
      streamPath,
      getHandler(factory, this.stream.bind(this) as Reducer<Payload, any, any>)
    );
    this.log.info("bgGreen", " GET ", streamPath);
  }

  // TODO: add snapshot query endpoints to swagger spec
  private _buildSnapshotQuery(store: SnapshotStore, path: string): void {
    this._router.get(path, snapshotQueryHandler(store));
    this.log.info("bgGreen", " GET ", path);
  }

  private _buildCommandHandlers(): void {
    const aggregates: Record<string, AggregateFactory<Payload, any, any>> = {};
    Object.values(this.endpoints.commandHandlers).forEach(
      ({ type, factory, commands }) => {
        type === "aggregate" && (aggregates[factory.name] = factory as any);
        Object.entries(commands).forEach(([name, path]) => {
          this._router.post(path, commandHandler(name, type));
          this.log.info("bgBlue", " POST ", path);
        });
      }
    );

    Object.values(this._factories.commandAdapters).forEach((factory) => {
      const path = decamelize("/".concat(factory.name));
      this._router.post(path, invokeHandler(factory));
      this.log.info("bgBlue", " POST ", path);
    });

    Object.values(aggregates).forEach((aggregate) => {
      this._buildGetters(aggregate);

      const snapOpts = this._snapshotOptions[aggregate.name];
      if (snapOpts && snapOpts.expose) {
        this._buildSnapshotQuery(
          snapOpts.store,
          `/${decamelize(aggregate.name)}`
        );
      }
    });
  }

  private _buildEventHandlers(): void {
    const managers: Record<
      string,
      ProcessManagerFactory<Payload, any, any>
    > = {};
    Object.values(this.endpoints.eventHandlers).forEach(
      ({ type, factory, path, events }) => {
        type === "process-manager" && (managers[factory.name] = factory as any);
        this._router.post(path, eventHandler(factory));
        this.log.info("bgMagenta", " POST ", path, events);
      }
    );

    Object.values(managers).forEach((manager) => this._buildGetters(manager));
  }

  build(middleware?: RequestHandler[]): express.Express {
    const { service, version, dependencies } = config();

    super.build();
    this._buildCommandHandlers();
    this._buildEventHandlers();
    if (this.hasStreams) {
      this._buildAllStreamRoute();
      this._buildStatsRoute();
    }

    this._app.set("trust proxy", true);
    this._app.use(cors());
    this._app.use(urlencoded({ extended: false }));
    this._app.use(express.json());
    middleware && this._app.use(middleware);
    this._app.use(this._router);

    // openapi
    this._swagger = swagger(this);
    this._app.get("/swagger", (_, res) => res.json(this._swagger));
    this._app.get("/_redoc", (_, res) => res.type("html").send(redoc(service)));

    // health related
    this._app.get("/_endpoints", (_, res) => res.json(this.endpoints));
    this._app.get("/_health", (_, res) =>
      res.status(200).json({ status: "OK", date: new Date().toISOString() })
    );
    this._app.get("/_config", (_, res) =>
      res.json({ service, version, dependencies })
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
    this._router.use(errorHandler); // ensure catch-all is last handler

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
