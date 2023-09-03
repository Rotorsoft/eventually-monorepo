import {
  Ok,
  client,
  httpError,
  log,
  store,
  toProjectionQuery,
  type Actor,
  type AggregateFactory,
  type AllQuery,
  type CommandAdapterFactory,
  type CommandHandlerFactory,
  type CommittedEvent,
  type EventHandlerFactory,
  type JsonResponse,
  type ProjectionRecord,
  type ProjectorFactory,
  type RestProjectionQuery,
  type Schema,
  type Snapshot,
  type State
} from "@rotorsoft/eventually";
import type { NextFunction, Request, Response } from "express";

const eTag = (res: Response, snapshot?: Snapshot): void => {
  const etag = snapshot?.event?.version;
  typeof etag === "number" && res.setHeader("ETag", etag.toString());
};

const send = (
  res: Response,
  { status, error, result }: JsonResponse<unknown>
): Response => res.status(status).send(error ?? result);

export const statsHandler = async (
  _: Request,
  res: Response,
  next: NextFunction
): Promise<Response | undefined> => {
  try {
    return send(res, Ok(await store().stats()));
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
    return send(res, Ok(await store().subscriptions()));
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
      const snap = await client().load(factory, id);
      eTag(res, snap);
      return send(res, Ok(snap));
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
      const snap = await client().command(factory, name, req.body, {
        stream: id,
        expectedVersion,
        actor
      });
      snap && eTag(res, snap);
      return send(res, Ok(snap));
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
      const snap = await client().invoke(factory, req.body);
      snap && eTag(res, snap);
      return send(res, Ok(snap));
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
      return send(res, Ok(await client().event(factory, req.body)));
    } catch (error) {
      next(error);
    }
  };

export const projectHandler =
  (factory: ProjectorFactory) =>
  async (
    req: Request<never, any, CommittedEvent[]>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      return send(res, Ok(await client().project(factory, req.body)));
    } catch (error) {
      next(error);
    }
  };

export const readHandler =
  (factory: ProjectorFactory, schema: Schema<State>) =>
  async (
    req: Request<never, ProjectionRecord[], never, RestProjectionQuery>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const query = toProjectionQuery(req.query, schema);
      return send(res, Ok(await client().read(factory, query)));
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
  send(res, httpError(error));
};

export const queryHandler = async (
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
