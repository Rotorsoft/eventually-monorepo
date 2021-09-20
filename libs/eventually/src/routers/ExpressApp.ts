import express, { NextFunction, Request, Response, Router } from "express";
import { AppBase, LogEntry } from "../AppBase";
import { config } from "../config";
import {
  Aggregate,
  decamelize,
  handlersOf,
  MessageFactory,
  ModelReducer,
  Payload
} from "../core";

type GetCallback = <Model extends Payload, Events>(
  reducer: ModelReducer<Model, Events>
) => Promise<Model | LogEntry<Model>[]>;

export class ExpressApp extends AppBase {
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

  use<Model extends Payload, Commands, Events>(
    aggregate: (id: string) => Aggregate<Model, Commands, Events>,
    factory: MessageFactory<Commands>
  ): void {
    this._get(aggregate, this.load.bind(this));
    this._get(aggregate, this.stream.bind(this), "/stream");
    handlersOf(factory).map((f) => {
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
              const [state, committed] = await this.handle(
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
      return this.register(command.name, path);
    });
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
