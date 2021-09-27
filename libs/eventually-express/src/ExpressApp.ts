import {
  AggregateFactory,
  aggregatePath,
  AppBase,
  Broker,
  committedSchema,
  Errors,
  Evt,
  InMemoryBroker,
  InMemoryStore,
  MsgOf,
  Payload,
  Snapshot,
  Store,
  ValidationError
} from "@rotorsoft/eventually";
import cors from "cors";
import express, { NextFunction, Request, Response, Router } from "express";

type GetCallback = <M extends Payload, C, E>(
  factory: AggregateFactory<M, C, E>,
  id: string
) => Promise<Snapshot<M> | Snapshot<M>[]>;

export class ExpressApp extends AppBase {
  private _router: Router = Router();

  private _buildStreamRoute(): void {
    this._router.get(
      "/stream/:event?",
      async (
        req: Request<
          { event?: string },
          Evt[],
          any,
          { after?: number; limit?: number }
        >,
        res: Response,
        next: NextFunction
      ) => {
        try {
          const { event } = req.params;
          const { after, limit } = req.query;
          const result = await this._store.read(event, after, limit);
          return res.status(200).send(result);
        } catch (error) {
          next(error);
        }
      }
    );
    this.log.info("green", "[GET]", "/stream/[event]?after=-1&limit=1");
  }

  private _get<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    callback: GetCallback,
    suffix?: string
  ): void {
    const { name, path } = aggregatePath(factory);
    this._router.get(
      path.concat(suffix || ""),
      async (
        req: Request<{ id: string }>,
        res: Response,
        next: NextFunction
      ) => {
        try {
          const { id } = req.params;
          const result = await callback(factory, id);
          let etag = "-1";
          if (Array.isArray(result)) {
            if (result.length)
              etag = result[result.length - 1].event.aggregateVersion;
          } else if (result.event) {
            etag = result.event.aggregateVersion;
          }
          res.setHeader("ETag", etag);
          return res.status(200).send(result);
        } catch (error) {
          next(error);
        }
      }
    );
    this.log.info("green", `[GET ${name}]`, path.concat(suffix || ""));
  }

  private _buildAggregates(): void {
    const aggregates: Record<
      string,
      AggregateFactory<Payload, unknown, unknown>
    > = {};
    Object.values(this._command_handlers).map(({ factory, command, path }) => {
      aggregates[factory.name] = factory;
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
            const { id } = req.params;
            const expectedVersion = req.headers["if-match"];
            const [state, committed] = await this.command(
              factory,
              id,
              value,
              expectedVersion
            );
            res.setHeader("ETag", committed.aggregateVersion);
            return res.status(200).send([committed, state]);
          } catch (error) {
            next(error);
          }
        }
      );
    });

    Object.values(aggregates).map((factory) => {
      this._get(factory, this.load.bind(this));
      this._get(factory, this.stream.bind(this), "/stream");
    });
  }

  private _buildPolicies(): void {
    Object.values(this._event_handlers).map(({ factory, event, path }) => {
      this._router.post(
        path,
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            const message = this._broker.decode(req.body);
            const validator = committedSchema(
              (event as unknown as MsgOf<unknown>).schema()
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
      return this._broker.subscribe(factory, event);
    });
  }

  async build(options?: {
    store?: Store;
    broker?: Broker;
  }): Promise<express.Express> {
    this._store = options?.store || InMemoryStore();
    this._broker = options?.broker || InMemoryBroker(this);

    await this.buildTopics();
    this._buildAggregates();
    this._buildPolicies();
    this._buildStreamRoute();

    const app = express();
    app.set("trust proxy", true);
    app.use(cors());
    app.use(express.json());
    app.use(this._router);

    // eslint-disable-next-line
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.log.error(err);
      if (err.message === Errors.ValidationError)
        res.status(400).send((err as ValidationError).details);
      else res.sendStatus(500);
    });

    return app;
  }
}
