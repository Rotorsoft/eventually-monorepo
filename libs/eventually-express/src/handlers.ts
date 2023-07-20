import {
  Actor,
  AggregateFactory,
  AllQuery,
  client,
  CommandAdapterFactory,
  CommandHandlerFactory,
  CommittedEvent,
  Errors,
  EventHandlerFactory,
  log,
  ProjectionRecord,
  ProjectionResults,
  ProjectorFactory,
  Snapshot,
  State,
  store
} from "@rotorsoft/eventually";
import {
  config,
  RestProjectionQuery,
  toProjectionQuery
} from "@rotorsoft/eventually-openapi";
import { NextFunction, Request, Response } from "express";
import { ZodObject, ZodType } from "zod";

const eTag = (res: Response, snapshot?: Snapshot): void => {
  const etag = snapshot?.event?.version;
  typeof etag === "number" && res.setHeader("ETag", etag.toString());
};

export const statsHandler = async (
  _: Request,
  res: Response,
  next: NextFunction
): Promise<Response | undefined> => {
  try {
    const stats = await store().stats();
    return res.status(200).send(stats);
  } catch (error) {
    next(error);
  }
};

export const subscriptionsHandler = async (
  _: Request,
  res: Response,
  next: NextFunction
): Promise<Response | undefined> => {
  try {
    const subscriptions = await store().subscriptions();
    return res.status(200).send(subscriptions);
  } catch (error) {
    next(error);
  }
};

export const allStreamHandler = async (
  req: Request<never, CommittedEvent[], never, AllQuery>,
  res: Response,
  next: NextFunction
): Promise<Response | undefined> => {
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
    res.header("content-type", "application/json");
    res.write("[");
    let i = 0;
    await client().query(
      {
        stream,
        names: names && (Array.isArray(names) ? names : [names]),
        after: after && +after,
        before: before && +before,
        limit: limit && +limit,
        created_after: created_after && new Date(created_after),
        created_before: created_before && new Date(created_before),
        correlation,
        backward
      },
      (e) => {
        i && res.write(",");
        res.write(JSON.stringify(e));
        i++;
      }
    );
    res.write("]");
    return res.status(200).end();
  } catch (error) {
    next(error);
  }
};

export const getHandler =
  (factory: AggregateFactory) =>
  async (
    req: Request<{ id: string }, Snapshot, never, never>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const { id } = req.params;
      const snapshot = await client().load(factory, id);
      eTag(res, snapshot);
      return res.status(200).send(snapshot);
    } catch (error) {
      next(error);
    }
  };

export const getStreamHandler =
  (factory: AggregateFactory) =>
  async (
    req: Request<{ id: string }, Snapshot[], never, never>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const { id } = req.params;
      res.header("content-type", "application/json");
      res.write("[");
      let i = 0;
      await client().load(factory, id, (s) => {
        i && res.write(",");
        res.write(JSON.stringify(s));
        i++;
      });
      res.write("]");
      return res.status(200).end();
    } catch (error) {
      next(error);
    }
  };

export const commandHandler =
  (factory: CommandHandlerFactory, name: string, withEtag: boolean) =>
  async (
    req: Request<{ id: string }, any, State, never> & {
      actor?: Actor;
    },
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const { id } = req.params;
      const ifMatch = req.headers["if-match"] || undefined;
      const expectedVersion = withEtag && ifMatch ? +ifMatch : undefined;
      const { actor } = req;
      const snapshots = await client().command(factory, name, req.body, {
        stream: id,
        expectedVersion,
        actor
      });
      eTag(res, snapshots.at(-1));
      return res.status(200).send(snapshots);
    } catch (error) {
      next(error);
    }
  };

export const invokeHandler =
  (factory: CommandAdapterFactory) =>
  async (
    req: Request<never, any, State, never> & {
      actor?: Actor;
    },
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const snapshots = await client().invoke(factory, req.body);
      eTag(res, snapshots.at(-1));
      return res.status(200).send(snapshots);
    } catch (error) {
      next(error);
    }
  };

export const eventHandler =
  (factory: EventHandlerFactory) =>
  async (
    req: Request<never, any, CommittedEvent>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const response = await client().event(factory, req.body);
      return res.status(200).send(response);
    } catch (error) {
      next(error);
    }
  };

export const eventsHandler =
  (factory: ProjectorFactory) =>
  async (
    req: Request<never, any, CommittedEvent[]>,
    res: Response<ProjectionResults>
  ): Promise<Response | undefined> => {
    res.header("content-type", "application/json");
    res.write("[");
    for (let i = 0; i < req.body.length; i++) {
      i && res.write(",");
      const event = req.body[i];
      try {
        const response = await client().event(factory, event);
        res.write(JSON.stringify(response));
      } catch (_error: unknown) {
        log().error(_error);
        const error =
          _error instanceof Error
            ? _error.message
            : typeof _error === "string"
            ? _error
            : `Error found when handling ${req.body[i].name} at position ${i}.`;
        res.write(JSON.stringify({ id: event.id, error }));
        break;
      }
    }
    res.write("]");
    return res.status(200).end();
  };

export const readHandler =
  (factory: ProjectorFactory, schema: ZodType) =>
  async (
    req: Request<never, ProjectionRecord[], never, RestProjectionQuery>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const query = toProjectionQuery(req.query, schema as ZodObject<State>);
      log().green().trace(`${factory.name}?`, query);

      res.header("content-type", "application/json");
      res.write("[");
      let i = 0;
      await client().read(factory, query, (record) => {
        i && res.write(",");
        res.write(JSON.stringify(record));
        i++;
      });
      res.write("]");
      return res.status(200).end();
    } catch (error) {
      next(error);
    }
  };

export const errorHandler = (
  error: Error,
  _: Request,
  res: Response,
  next: NextFunction
): void => {
  log().error(error);
  if (res.headersSent) return next(error);
  const { name, message, stack, ...other } = error;
  switch (name) {
    case Errors.ValidationError:
    case Errors.InvariantError:
      res.status(400).send({ name, message, ...other });
      break;
    case Errors.RegistrationError:
      res.status(404).send({ name, message, ...other });
      break;
    case Errors.ConcurrencyError:
      res.status(409).send({ name, message, ...other });
      break;
    case Errors.ActorConcurrencyError:
      res.status(409).send({ name, message, ...other });
      break;
    default:
      res.status(500).send({
        name,
        message,
        stack: config.env !== "production" && stack
      });
  }
};
