import express, { NextFunction, Request, Response, Router } from "express";
import { AggregateFactory, CommittedEvent, Store } from "..";
import { AppBase, LogEntry } from "../AppBase";
import { config } from "../config";
import { MessageFactory, ModelReducer, Payload, PolicyFactory } from "../types";
import { aggregatePath, decamelize, handlersOf } from "../utils";

type GetCallback = <Model extends Payload, Events>(
  reducer: ModelReducer<Model, Events>
) => Promise<Model | LogEntry<Model>[]>;

export class ExpressApp extends AppBase {
  private _router: Router = Router();

  constructor(store: Store) {
    super(store);
    this._router.get(
      "/stream/:event?",
      async (
        req: Request<
          { event?: string },
          CommittedEvent<string, Payload>[],
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
          if (Array.isArray(result) && result.length)
            res.setHeader(
              "ETag",
              result[result.length - 1].event.aggregateVersion
            );
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
      const command = f();
      const path = "/".concat(
        decamelize(factory("").name()),
        "/:id/",
        decamelize(command.name)
      );
      this._router.post(
        path,
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
      return this.register(command.name, factory, path);
    });
  }

  withPolicy<Commands, Events>(
    factory: PolicyFactory<Commands, Events>,
    events: MessageFactory<Events>
  ): void {
    const instance = factory();
    handlersOf(events).map((f) => {
      const event = f();
      if (Object.keys(instance).includes("on".concat(event.name))) {
        const path = "/".concat(
          decamelize(instance.name()),
          "/",
          decamelize(event.name)
        );
        this._router.post(
          path,
          async (req: Request, res: Response, next: NextFunction) => {
            const { error, value } = event.schema().validate(req.body);
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
        return this.subscribe(event, factory, path);
      }
    });
  }

  listen(): void {
    const app = express();
    app.use(express.json());
    app.use(this._router);
    // eslint-disable-next-line
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      res.status(500).send(err.message);
    });

    app.listen(config.port, () => {
      this.log.info("Express app is listening", config);
    });
  }

  async emit(event: CommittedEvent<string, Payload>): Promise<void> {
    // TODO schedule async emit jobs and handle failures
    await super.emit(event);
  }
}
