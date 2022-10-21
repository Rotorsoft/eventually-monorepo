import {
  Actor,
  AllQuery,
  app,
  bind,
  CommandAdapterFactory,
  CommandHandlerType,
  CommittedEvent,
  config,
  Errors,
  EventHandlerFactory,
  formatTime,
  log,
  Payload,
  Reducer,
  ReducibleFactory,
  Snapshot,
  SnapshotsQuery,
  SnapshotStore,
  store
} from "@rotorsoft/eventually";
import { NextFunction, Request, Response } from "express";

export const statsHandler = async (
  _: Request,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const stats = await store().stats();
    return res.status(200).send(stats);
  } catch (error) {
    next(error);
  }
};

export const allStreamHandler = async (
  req: Request<any, CommittedEvent<string, Payload>[], any, AllQuery>,
  res: Response,
  next: NextFunction
): Promise<Response> => {
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
    const result = await app().query({
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
};

export const getHandler =
  <M extends Payload, C, E>(
    factory: ReducibleFactory<M, C, E>,
    callback: Reducer<M, C, E>
  ) =>
  async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      const { id } = req.params;
      const result = await callback(
        factory,
        id,
        ["true", "1"].includes(req.query.useSnapshots as string)
      );
      let etag = "-1";
      if (Array.isArray(result)) {
        result.length && (etag = result.at(-1).event.version.toString());
      } else if (result.event) {
        etag = result.event.version.toString();
      }
      res.setHeader("ETag", etag);
      return res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

export const snapshotQueryHandler =
  (store: SnapshotStore) =>
  async (
    req: Request<any, Snapshot<Payload>, any, SnapshotsQuery>,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      const { limit = 10 } = req.query;
      const result = await store.query({
        limit
      });
      return res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

export const commandHandler =
  (name: string, type: CommandHandlerType) =>
  async (
    req: Request<{ id: string }, any, Payload, never> & {
      actor?: Actor;
    },
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      const ifMatch = req.headers["if-match"] || undefined;
      const snapshots = await app().command(
        bind(
          name,
          req.body,
          req.params.id,
          type === "aggregate" && ifMatch ? +ifMatch : undefined,
          req.actor
        )
      );
      snapshots.length && res.setHeader("ETag", snapshots.at(-1).event.version);
      return res.status(200).send(snapshots);
    } catch (error) {
      next(error);
    }
  };

export const invokeHandler =
  (factory: CommandAdapterFactory<Payload, Payload>) =>
  async (
    req: Request<never, any, Payload, never> & {
      actor?: Actor;
    },
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      const snapshots = await app().invoke(factory, req.body);
      snapshots.length && res.setHeader("ETag", snapshots.at(-1).event.version);
      return res.status(200).send(snapshots);
    } catch (error) {
      next(error);
    }
  };

export const eventHandler =
  (factory: EventHandlerFactory<Payload, unknown, unknown>) =>
  async (
    req: Request<never, any, CommittedEvent<string, Payload>>,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const response = await app().event(factory, req.body as any);
      return res.status(200).send(response);
    } catch (error) {
      next(error);
    }
  };

export const appHandler = (_: Request, res: Response): Response => {
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

  return res.status(200).json({
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
};

export const errorHandler = (
  error: Error,
  _: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  __: NextFunction
): Response => {
  log().error(error);
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
};
