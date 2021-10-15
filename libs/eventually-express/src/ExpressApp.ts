import {
  AggregateFactory,
  AllQuery,
  AppBase,
  broker,
  committedSchema,
  config,
  Errors,
  Evt,
  Getter,
  Msg,
  Payload,
  ProcessManagerFactory,
  reduciblePath,
  ValidationError
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

export class ExpressApp extends AppBase {
  private _app = express();
  private _router = Router();
  private _server: Server;

  private _buildAllStreamRoute(): void {
    this._router.get(
      "/all",
      async (
        req: Request<any, Evt[], any, AllQuery>,
        res: Response,
        next: NextFunction
      ) => {
        try {
          const { stream, name, after = -1, limit = 1 } = req.query;
          const result = await this.read({
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
    factory: AggregateFactory<M, C, E> | ProcessManagerFactory<M, C, E>,
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
              ? { ...factory(undefined), stream: () => id }
              : (factory as AggregateFactory<M, C, E>)(id)
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
    Object.values(this._handlers.commands)
      .filter(({ type, factory, command }) => {
        if (type === "aggregate")
          aggregates[factory.name] = factory as AggregateFactory<
            Payload,
            unknown,
            unknown
          >;
        return command.scope() === "public";
      })
      .map(({ type, factory, command, path }) => {
        this._router.post(
          path,
          async (
            req: Request<{ id: string }>,
            res: Response,
            next: NextFunction
          ) => {
            try {
              const { error, value } = command
                .schema()
                .validate(req.body, { abortEarly: false });
              if (error) throw new ValidationError(error);
              const snapshots = await this.command(
                factory(req.params.id),
                value,
                type === "aggregate" ? +req.headers["if-match"] : undefined
              );
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
      });

    Object.values(aggregates).map((factory) => {
      this.log.info("green", factory.name);

      const getpath = reduciblePath(factory);
      this._buildGetter(factory, this.load.bind(this), getpath);
      this.log.info("green", "  ", `GET ${getpath}`);

      const streampath = reduciblePath(factory).concat("/stream");
      this._buildGetter(factory, this.stream.bind(this), streampath);
      this.log.info("green", "  ", `GET ${streampath}`);
    });
  }

  private _buildEventHandlers(): void {
    const managers: Record<
      string,
      ProcessManagerFactory<Payload, unknown, unknown>
    > = {};
    Object.values(this._handlers.events)
      .filter(({ type, factory, event }) => {
        if (type === "process-manager")
          managers[factory.name] = factory as ProcessManagerFactory<
            Payload,
            unknown,
            unknown
          >;
        return event.scope() === "public";
      })
      .map(({ factory, event, path }) => {
        this._router.post(
          path,
          async (req: Request, res: Response, next: NextFunction) => {
            try {
              const message = broker().decode(req.body);
              const validator = committedSchema(
                (event as unknown as Msg).schema()
              );
              const { error, value } = validator.validate(message, {
                abortEarly: false
              });
              if (error) throw new ValidationError(error);
              const response = await this.event(factory, value);
              return res.status(200).send(response);
            } catch (error) {
              next(error);
            }
          }
        );
      });

    Object.values(managers).map((factory) => {
      this.log.info("green", factory.name);

      const getpath = reduciblePath(factory);
      this._buildGetter(factory, this.load.bind(this), getpath, true);
      this.log.info("green", "  ", `GET ${getpath}`);

      const streampath = reduciblePath(factory).concat("/stream");
      this._buildGetter(factory, this.stream.bind(this), streampath, true);
      this.log.info("green", "  ", `GET ${streampath}`);
    });
  }

  build(): express.Express {
    super.build();

    this._buildCommandHandlers();
    this._buildEventHandlers();
    this._buildAllStreamRoute();

    this._app.set("trust proxy", true);
    this._app.use(cors());
    this._app.use(urlencoded({ extended: false }));
    this._app.use(express.json());
    this._app.use(this._router);
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

    return this._app;
  }

  /**
   * Starts listening
   * @param silent flag to skip express listening when using cloud functions
   */
  async listen(silent = false): Promise<void> {
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
