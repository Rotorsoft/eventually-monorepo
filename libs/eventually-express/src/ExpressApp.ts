import {
  Actor,
  AggregateFactory,
  AllQuery,
  AppBase,
  bind,
  CommittedEvent,
  config,
  Errors,
  Getter,
  Payload,
  ProcessManagerFactory,
  ReducibleFactory,
  reduciblePath,
  store
} from "@rotorsoft/eventually";
import cluster from "cluster";
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

export class ExpressApp extends AppBase {
  private _app = express();
  private _router = Router();
  private _server: Server;
  private _swagger: any;

  public getSwagger(): any {
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
            created_after
          } = req.query;
          const result = await this.query({
            stream,
            names: names && (Array.isArray(names) ? names : [names]),
            after: after && +after,
            before: before && +before,
            limit: limit && +limit,
            created_after: created_after && new Date(created_after),
            created_before: created_before && new Date(created_before)
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
    Object.values(this.endpoints.commands).map(
      ({ type, factory, name, path }) => {
        type === "aggregate" && (aggregates[factory.name] = factory as any);
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
      }
    );

    Object.values(aggregates).map((aggregate) => {
      const getpath = reduciblePath(aggregate);
      this._buildGetter(aggregate, this.load.bind(this), getpath);
      this.log.info("bgGreen", " GET ", getpath);

      const streampath = reduciblePath(aggregate).concat("/stream");
      this._buildGetter(aggregate, this.stream.bind(this), streampath);
      this.log.info("bgGreen", " GET ", streampath);
    });
  }

  private _buildEventHandlers(): void {
    const managers: Record<
      string,
      ProcessManagerFactory<Payload, unknown, unknown>
    > = {};
    Object.values(this.endpoints.eventHandlers).map(
      ({ type, factory, path }) => {
        type === "process-manager" && (managers[factory.name] = factory as any);
        this._router.post(
          path,
          async (
            req: Request<never, any, CommittedEvent<string, Payload>>,
            res: Response,
            next: NextFunction
          ) => {
            try {
              const message = req.body;
              const meta = this.messages[message.name];
              if (meta && meta.eventHandlerFactories[path]) {
                const response = await this.event(factory, message as any);
                return res.status(200).send(response);
              }
              // ignore events not handled by this handler
              return res.send(`Ignored ${message.name}`);
            } catch (error) {
              next(error);
            }
          }
        );
      }
    );

    Object.values(managers).map((manager) => {
      const getpath = reduciblePath(manager);
      this._buildGetter(manager, this.load.bind(this), getpath, true);
      this.log.info("bgGreen", " GET ", getpath);

      const streampath = reduciblePath(manager).concat("/stream");
      this._buildGetter(manager, this.stream.bind(this), streampath, true);
      this.log.info("bgGreen", " GET ", streampath);
    });
  }

  build(middleware?: RequestHandler[]): express.Express {
    super.build();
    this._buildCommandHandlers();
    this._buildEventHandlers();
    if (
      Object.keys(this.endpoints.commands).length ||
      Object.values(this.endpoints.eventHandlers).filter(
        (eh) => eh.type === "process-manager"
      ).length
    ) {
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
      swaggerUI.setup(this._swagger)
    );
    return this._app;
  }

  /**
   * Starts listening
   * @param silent flag to skip express listening when using cloud functions
   * @param port to override port in config
   */
  async listen(silent = false, port?: number): Promise<void> {
    const { host, service, version, env, logLevel } = config();
    port = port || config().port;
    this._app.get("/_health", (_, res: Response) => {
      res.status(200).json({ status: "OK" });
    });
    this._app.get("/", (_, res: Response) => {
      res.status(200).json({
        env,
        service,
        version,
        logLevel,
        mem: process.memoryUsage(),
        uptime: process.uptime(),
        swagger: `${host}/swagger-ui`,
        health: `${host}/_health`
      });
    });

    // ensure catch-all is last handler
    this._app.use(
      // eslint-disable-next-line
      (error: Error, _: Request, res: Response, __: NextFunction) => {
        this.log.error(error);
        // eslint-disable-next-line
        const { message, stack, ...other } = error;
        if (message === Errors.ValidationError)
          res.status(400).send({ message, ...other });
        else if (message === Errors.ConcurrencyError)
          res.status(409).send({ message, ...other });
        else res.status(500).send({ message });
      }
    );

    await super.listen();
    if (silent) this.log.info("white", "Config", undefined, config());
    else
      this._server = this._app.listen(port, () => {
        !cluster.isWorker &&
          this.log.info(
            "white",
            "Express app is listening",
            undefined,
            config()
          );
      });
  }

  async close(): Promise<void> {
    await super.close();
    if (this._server) {
      this._server.close();
      delete this._server;
    }
  }
}
