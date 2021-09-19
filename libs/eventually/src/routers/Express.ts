import express, { NextFunction, Request, Response, Router } from "express";
import { config } from "../config";
import {
  Aggregate,
  MessageFactory,
  ModelReducer,
  Payload,
  Policy,
  Projector
} from "../core";
import { AppBase, decamelize, handlersOf, LogEntry } from "../engine";

type GetCallback = <Model extends Payload, Events>(
  reducer: ModelReducer<Model, Events>
) => Promise<Model | LogEntry<Model>[]>;

export class Express extends AppBase {
  private router: Router = Router();

  private _get<Model extends Payload, Events>(
    factory: (id: string) => ModelReducer<Model, Events>,
    callback: GetCallback,
    suffix?: string
  ): void {
    const { name, path } = super.reducerPath(factory);
    this.router.get(
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
            res.setHeader("ETag", result[result.length - 1].event.version);
          return res.status(200).send(result);
        } catch (error) {
          this.log.error(error);
          next(error);
        }
      }
    );
    this.log.trace("green", `[GET ${name}]`, path.concat(suffix || ""));
  }

  async routeAggregate<Model extends Payload, Commands, Events>(
    aggregate: (id: string) => Aggregate<Model, Commands, Events>,
    factory: MessageFactory<Commands>
  ): Promise<void> {
    this._get(aggregate, this.load.bind(this));
    this._get(aggregate, this.stream.bind(this), "/stream");
    const promises = handlersOf(factory).map((f) => {
      const command = f();
      const path = "/".concat(
        decamelize(aggregate("").name()),
        "/:id/",
        decamelize(command.name)
      );
      this.router.post(
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
              const [state, committed] = await this.handleCommand(
                aggregate(id),
                value,
                expectedVersion
              );
              res.setHeader("ETag", committed.version);
              return res.status(200).send([committed, state]);
            } catch (error) {
              this.log.error(error);
              next(error);
            }
          }
        }
      );
      return this.register(command.name, aggregate, path);
    });
    await Promise.all(promises);
  }

  async routePolicy<Commands, Events>(
    policy: () => Policy<Commands, Events>,
    factory: MessageFactory<Events>
  ): Promise<void> {
    const instance = policy();
    const promises = handlersOf(factory).map(async (f) => {
      const event = f();
      if (Object.keys(instance).includes("on".concat(event.name))) {
        const path = "/".concat(
          decamelize(instance.name()),
          "/",
          decamelize(event.name)
        );
        this.router.post(
          path,
          async (req: Request, res: Response, next: NextFunction) => {
            const { error, value } = event
              .schema()
              .validate(this.broker.body(req.body));
            if (error) res.status(400).send(error.toString());
            else {
              try {
                const response = await this.handleEvent(policy(), value);
                return res.status(200).send(response);
              } catch (error) {
                this.log.error(error);
                next(error);
              }
            }
          }
        );
        return this.subscribe(event, policy, path);
      }
    });
    await Promise.all(promises);
  }

  async routeProjector<Events>(
    projector: () => Projector<Events>,
    factory: MessageFactory<Events>
  ): Promise<void> {
    const instance = projector();
    const promises = handlersOf(factory).map(async (f) => {
      const event = f();
      if (Object.keys(instance).includes("on".concat(event.name))) {
        const path = "/".concat(
          decamelize(instance.name()),
          "/",
          decamelize(event.name)
        );
        this.router.post(
          path,
          async (req: Request, res: Response, next: NextFunction) => {
            const { error, value } = event
              .schema()
              .validate(this.broker.body(req.body));
            if (error) res.status(400).send(error.toString());
            else {
              try {
                const response = await this.handleProjection(
                  projector(),
                  value
                );
                return res.status(200).send(response);
              } catch (error) {
                this.log.error(error);
                next(error);
              }
            }
          }
        );
        return this.subscribe(event, projector, path);
      }
    });
    await Promise.all(promises);
  }

  listen(): void {
    const app = express();
    app.use(express.json());
    app.use(this.router);
    // eslint-disable-next-line
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      res.status(500).send(err.message);
    });

    app.listen(config.port, () => {
      this.log.info("Express app is listening", config);
    });
  }
}
