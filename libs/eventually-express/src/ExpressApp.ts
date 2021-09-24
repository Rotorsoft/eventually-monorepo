import {
  AggregateFactory,
  aggregatePath,
  AppBase,
  Broker,
  commandPath,
  committedSchema,
  eventPath,
  Evt,
  handlersOf,
  MessageFactory,
  ModelReducer,
  MsgOf,
  Payload,
  PolicyFactory,
  Snapshot,
  Store
} from "@rotorsoft/eventually";
import cors from "cors";
import express, { NextFunction, Request, Response, Router } from "express";

type GetCallback = <Model extends Payload, Events>(
  reducer: ModelReducer<Model, Events>
) => Promise<Snapshot<Model> | Snapshot<Model>[]>;

export class ExpressApp extends AppBase {
  private _router: Router = Router();

  constructor(store: Store, broker: Broker) {
    super(store, broker);
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
        const { event } = req.params;
        const { after, limit } = req.query;
        try {
          const result = await this.store.read(event, after, limit);
          return res.status(200).send(result);
        } catch (error) {
          this.log.error(error);
          next(error);
        }
      }
    );
    this.log.trace("green", "[GET]", "/stream/[event]?after=-1&limit=1");
  }

  private _get<Model extends Payload, Events>(
    factory: (id: string) => ModelReducer<Model, Events>,
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
        const { id } = req.params;
        try {
          const result = await callback(factory(id));
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
          this.log.error(error);
          next(error);
        }
      }
    );
    this.log.trace("green", `[GET ${name}]`, path.concat(suffix || ""));
  }

  withAggregate<Model extends Payload, Commands, Events>(
    factory: AggregateFactory<Model, Commands, Events>,
    commands: MessageFactory<Commands>
  ): void {
    this._get(factory, this.load.bind(this));
    this._get(factory, this.stream.bind(this), "/stream");
    handlersOf(commands).map((f) => {
      const command = f() as MsgOf<Commands>;
      this._router.post(
        commandPath(factory, command),
        async (
          req: Request<{ id: string }>,
          res: Response,
          next: NextFunction
        ) => {
          const { error, value } = command.schema().validate(req.body);
          if (error) res.status(400).send(error.toString());
          else {
            const { id } = req.params;
            const expectedVersion = req.headers["if-match"];
            try {
              const [state, committed] = await this.command(
                factory(id),
                value,
                expectedVersion
              );
              res.setHeader("ETag", committed.aggregateVersion);
              return res.status(200).send([committed, state]);
            } catch (error) {
              this.log.error(error);
              next(error);
            }
          }
        }
      );
      return this.register(factory, command);
    });
  }

  withPolicy<Commands, Events>(
    factory: PolicyFactory<Commands, Events>,
    events: MessageFactory<Events>
  ): void {
    const instance = factory();
    handlersOf(events).map((f) => {
      const event = f() as MsgOf<Events>;
      if (Object.keys(instance).includes("on".concat(event.name))) {
        this._router.post(
          eventPath(instance, event),
          async (req: Request, res: Response, next: NextFunction) => {
            const message = this.broker.decode(req.body);
            const validator = committedSchema(event.schema());
            const { error, value } = validator.validate(message);
            if (error) res.status(400).send(error.toString());
            else {
              try {
                const response = await this.event(factory(), value);
                return res.status(200).send(response);
              } catch (error) {
                this.log.error(error);
                next(error);
              }
            }
          }
        );
        return this.broker.subscribe(instance, event);
      }
    });
  }

  build(): express.Express {
    const app = express();
    app.set("trust proxy", true);
    app.use(cors());
    app.use(express.json());
    app.use(this._router);

    // eslint-disable-next-line
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      res.status(500).send(err.message);
    });

    return app;
  }
}
