import {
  Actor,
  AggregateFactory,
  AllQuery,
  AppBase,
  bind,
  CommittedEvent,
  config,
  Errors,
  formatTime,
  Getter,
  Payload,
  ProcessManagerFactory,
  ReducibleFactory,
  reduciblePath,
  store
} from "@rotorsoft/eventually";
import cors from "cors";
import express, {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
  urlencoded
} from "express";
import { Server } from "http";
import * as swaggerUI from "swagger-ui-express";
import { swagger } from "./swagger";
import { OpenAPIV3_1 } from "openapi-types";

const redoc = (title: string): string => `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url='/swagger'></redoc>
    <script src="https://unpkg.com/redoc@latest/bundles/redoc.standalone.js"> </script>
  </body>
</html>`;

const rapidoc = (title: string): string => `<!doctype html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8">
  <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
</head>
<body>
  <rapi-doc
    spec-url="/swagger"
    theme = "dark"
  > </rapi-doc>
</body>
</html>`;

export class ExpressApp extends AppBase {
  private _app = express();
  private _router = Router();
  private _server: Server;
  private _swagger: OpenAPIV3_1.Document;

  public getSwagger(): OpenAPIV3_1.Document {
    return this._swagger;
  }

  private _buildStatsRoute(): void {
    this._router.get("/stats", async (_, res: Response, next: NextFunction) => {
      try {
        const stats = await store().stats();
        return res.status(200).send(stats);
      } catch (error) {
        next(error);
      }
    });
    this.log.info("bgGreen", " GET ", "/stats");
  }

  private _buildAllStreamRoute(): void {
    this._router.get(
      "/all",
      async (
        req: Request<any, CommittedEvent<string, Payload>[], any, AllQuery>,
        res: Response,
        next: NextFunction
      ) => {
        try {
          const {
            stream,
            names,
            before,
            after = -1,
            limit = 1,
            created_before,
            created_after,
            correlation,
            backward
          } = req.query;
          const result = await this.query({
            stream,
            names: names && (Array.isArray(names) ? names : [names]),
            after: after && +after,
            before: before && +before,
            limit: limit && +limit,
            created_after: created_after && new Date(created_after),
            created_before: created_before && new Date(created_before),
            correlation,
            backward
          });
          return res.status(200).send(result);
        } catch (error) {
          next(error);
        }
      }
    );
    this.log.info(
      "bgGreen",
      " GET ",
      "/all?[stream=...][&names=...][&after=-1][&limit=1][&before=...][&created_after=...][&created_before=...]"
    );
  }

  private _buildGetter<M extends Payload, C, E>(
    reducible: ReducibleFactory<M, C, E>,
    callback: Getter,
    path: string,
    overrideId = false
  ): void {
    this._router.get(
      path,
      async (
        req: Request<{ id: string }>,
        res: Response,
        next: NextFunction
      ) => {
        try {
          const { id } = req.params;
          const result = await callback(
            overrideId
              ? { ...reducible(undefined), stream: () => id }
              : (reducible as AggregateFactory<M, C, E>)(id),
            ["true", "1"].includes(req.query.useSnapshots as string)
          );
          let etag = "-1";
          if (Array.isArray(result)) {
            if (result.length)
              etag = result[result.length - 1].event.version.toString();
          } else if (result.event) {
            etag = result.event.version.toString();
          }
          res.setHeader("ETag", etag);
          return res.status(200).send(result);
        } catch (error) {
          next(error);
        }
      }
    );
  }

  private _buildCommandHandlers(): void {
    const aggregates: Record<
      string,
      AggregateFactory<Payload, unknown, unknown>
    > = {};
    Object.values(this.endpoints.commandHandlers).map(
      ({ type, factory, commands }) => {
        type === "aggregate" && (aggregates[factory.name] = factory as any);
        Object.entries(commands).map(([name, path]) => {
          this._router.post(
            path,
            async (
              req: Request<{ id: string }, any, Payload, never> & {
                actor?: Actor;
              },
              res: Response,
              next: NextFunction
            ) => {
              try {
                const ifMatch = req.headers["if-match"] || undefined;
                const snapshots = await this.command(
                  bind(
                    name,
                    req.body,
                    req.params.id,
                    type === "aggregate" && ifMatch ? +ifMatch : undefined,
                    req.actor
                  )
                );
                snapshots.length &&
                  res.setHeader(
                    "ETag",
                    snapshots[snapshots.length - 1].event.version
                  );
                return res.status(200).send(snapshots);
              } catch (error) {
                next(error);
              }
            }
          );
          this.log.info("bgBlue", " POST ", path);
        });
      }
    );

    Object.values(aggregates).map((aggregate) => {
      const getpath = reduciblePath(aggregate);
      this._buildGetter(aggregate, this.load.bind(this) as Getter, getpath);
      this.log.info("bgGreen", " GET ", getpath);

      const streampath = reduciblePath(aggregate).concat("/stream");
      this._buildGetter(
        aggregate,
        this.stream.bind(this) as Getter,
        streampath
      );
      this.log.info("bgGreen", " GET ", streampath);
    });
  }

  private _buildEventHandlers(): void {
    const managers: Record<
      string,
      ProcessManagerFactory<Payload, unknown, unknown>
    > = {};
    Object.values(this.endpoints.eventHandlers).map(
      ({ type, factory, path, events }) => {
        type === "process-manager" && (managers[factory.name] = factory as any);
        this._router.post(
          path,
          async (
            req: Request<never, any, CommittedEvent<string, Payload>>,
            res: Response,
            next: NextFunction
          ) => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              const response = await this.event(factory, req.body as any);
              return res.status(200).send(response);
            } catch (error) {
              next(error);
            }
          }
        );
        this.log.info("bgMagenta", " POST ", path, events);
      }
    );

    Object.values(managers).map((manager) => {
      const getpath = reduciblePath(manager);
      this._buildGetter(manager, this.load.bind(this) as Getter, getpath, true);
      this.log.info("bgGreen", " GET ", getpath);

      const streampath = reduciblePath(manager).concat("/stream");
      this._buildGetter(
        manager,
        this.stream.bind(this) as Getter,
        streampath,
        true
      );
      this.log.info("bgGreen", " GET ", streampath);
    });
  }

  build(middleware?: RequestHandler[]): express.Express {
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

    this._swagger = swagger(this);
    this._app.get("/swagger", (_, res: Response) => {
      res.json(this._swagger);
    });
    this._app.use(
      "/swagger-ui",
      swaggerUI.serve,
      swaggerUI.setup(this._swagger, {
        swaggerOptions: {
          deepLinking: true
        }
      })
    );
    this._app.get("/redoc", (_, res) => {
      res.type("html");
      res.send(redoc(config().service));
    });
    this._app.get("/rapidoc", (_, res) => {
      res.type("html");
      res.send(rapidoc(config().service));
    });
    this._app.get("/_endpoints", (_, res) => {
      res.json(this.endpoints);
    });
    this._app.get("/_health", (_, res) => {
      res.status(200).json({ status: "OK", date: new Date().toISOString() });
    });
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
    const {
      service,
      version,
      env,
      logLevel,
      description,
      author,
      license,
      dependencies
    } = config();
    port = port || config().port;

    this._app.get("/", (_: Request, res: Response) => {
      res.status(200).json({
        env,
        service,
        version,
        description,
        author,
        license,
        dependencies,
        logLevel,
        mem: process.memoryUsage(),
        uptime: formatTime(process.uptime()),
        swagger: "/swagger",
        "swagger-ui": "/swagger-ui",
        redoc: "/redoc",
        rapidoc: "/rapidoc",
        health: "/_health",
        endpoints: "/_endpoints",
        contracts: "/_contracts"
      });
    });

    // ensure catch-all is last handler
    this._app.use(
      // eslint-disable-next-line
      (error: Error, _: Request, res: Response, __: NextFunction) => {
        this.log.error(error);
        // eslint-disable-next-line
        const { message, stack, ...other } = error;
        switch (message) {
          case Errors.ValidationError:
            return res.status(400).send({ message, ...other });
          case Errors.RegistrationError:
            return res.status(404).send({ message, ...other });
          case Errors.ConcurrencyError:
            return res.status(409).send({ message, ...other });
          default:
            return res.status(500).send({ message });
        }
      }
    );

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
        this._server.once("close", resolve);
        this._server.close(reject);
      });
      this._server = undefined;
    }
  }
}
