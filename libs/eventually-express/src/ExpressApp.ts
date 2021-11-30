import {
  AggregateFactory,
  AllQuery,
  AppBase,
  bind,
  broker,
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
import cors from "cors";
import express, {
  NextFunction,
  Request,
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
    this._router.get(
      "/stats",
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const stats = await store().stats();
          return res.status(200).send(stats);
        } catch (error) {
          next(error);
        }
      }
    );
    this.log.info("green", "Stats", "GET /stats");
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
          const { stream, name, after = -1, limit = 1 } = req.query;
          const result = await this.query({
            stream,
            name,
            after: after && +after,
            limit: limit && +limit
          });
          return res.status(200).send(result);
        } catch (error) {
          next(error);
        }
      }
    );
    this.log.info(
      "green",
      "All-Stream",
      "GET /all?[stream=...]&[name=...]&[after=-1]&[limit=1]"
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
            req: Request<{ id: string }, any, Payload>,
            res: Response,
            next: NextFunction
          ) => {
            try {
              const snapshots = await this.command(
                bind(
                  name,
                  req.body,
                  req.params.id,
                  type === "aggregate" ? +req.headers["if-match"] : undefined
                ) as any
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
      this.log.info("green", aggregate.name);

      const getpath = reduciblePath(aggregate);
      this._buildGetter(aggregate, this.load.bind(this), getpath);
      this.log.info("green", "  ", `GET ${getpath}`);

      const streampath = reduciblePath(aggregate).concat("/stream");
      this._buildGetter(aggregate, this.stream.bind(this), streampath);
      this.log.info("green", "  ", `GET ${streampath}`);
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
              const message = broker().decode(req.body);
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
      this.log.info("green", manager.name);

      const getpath = reduciblePath(manager);
      this._buildGetter(manager, this.load.bind(this), getpath, true);
      this.log.info("green", "  ", `GET ${getpath}`);

      const streampath = reduciblePath(manager).concat("/stream");
      this._buildGetter(manager, this.stream.bind(this), streampath, true);
      this.log.info("green", "  ", `GET ${streampath}`);
    });
  }

  build(): express.Express {
    super.build();
    this._buildCommandHandlers();
    this._buildEventHandlers();
    this._buildAllStreamRoute();
    this._buildStatsRoute();

    // TODO: use helmet?
    this._app.set("trust proxy", true);
    this._app.use(cors());
    this._app.use(urlencoded({ extended: false }));
    this._app.use(express.json());
    this._app.use(this._router);

    // swagger
    this._swagger = swagger(this);
    this._app.get("/swagger", (req: Request, res: Response) => {
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
   */
  async listen(silent = false): Promise<void> {
    // ensure catch-all is last handler
    this._app.use(
      // eslint-disable-next-line
      (error: Error, req: Request, res: Response, next: NextFunction) => {
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
      this._server = this._app.listen(config().port, () => {
        this.log.info("white", "Express app is listening", undefined, config());
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
