import {
  Actor,
  AllQuery,
  client,
  CommandAdapterFactory,
  CommandHandlerFactory,
  CommittedEvent,
  Errors,
  EventHandlerFactory,
  log,
  ProjectionResults,
  ProjectorFactory,
  ReducibleFactory,
  Snapshot,
  SnapshotsQuery,
  SnapshotStore,
  State,
  store,
  ProjectionState,
  ProjectionRecord
} from "@rotorsoft/eventually";
import { NextFunction, Request, Response } from "express";

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

export const allStreamHandler = async (
  req: Request<any, CommittedEvent[], any, AllQuery>,
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
  (factory: ReducibleFactory) =>
  async (
    req: Request<{ id: string }, Snapshot, never, { useSnapshots?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const { id } = req.params;
      const snap = ["true", "1"].includes(req.query.useSnapshots || "");
      const snapshot = await client().load(factory, id, snap);
      eTag(res, snapshot);
      return res.status(200).send(snapshot);
    } catch (error) {
      next(error);
    }
  };

export const getStreamHandler =
  (factory: ReducibleFactory) =>
  async (
    req: Request<{ id: string }, Snapshot[], never, { useSnapshots?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const { id } = req.params;
      const snap = ["true", "1"].includes(req.query.useSnapshots || "");
      res.header("content-type", "application/json");
      res.write("[");
      let i = 0;
      await client().load(factory, id, snap, (s) => {
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

export const snapshotQueryHandler =
  (store: SnapshotStore) =>
  async (
    req: Request<any, Snapshot, any, SnapshotsQuery>,
    res: Response,
    next: NextFunction
  ): Promise<Response | undefined> => {
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
        id,
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

export const projectHandler =
  (factory: ProjectorFactory) =>
  async (
    req: Request<never, any, CommittedEvent[]>,
    res: Response<ProjectionResults<ProjectionState>>,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      res.header("content-type", "application/json");
      res.write("[");
      for (let i = 0; i < req.body.length; i++) {
        i && res.write(",");
        res.write(JSON.stringify(await client().project(factory, req.body[i])));
      }
      res.write("]");
      return res.status(200).end();
    } catch (error) {
      next(error);
    }
  };

export const getProjectionHandler =
  (factory: ProjectorFactory) =>
  async (
    req: Request<{ id: string }, never, never, never>,
    res: Response<ProjectionRecord<ProjectionState>>,
    next: NextFunction
  ): Promise<Response | undefined> => {
    try {
      const { id } = req.params;
      const response = await client().read(factory, [id]);
      return res.status(200).send(response[id]);
    } catch (error) {
      next(error);
    }
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
  const { name, message, stack, ...other } = error;
  switch (name) {
    case Errors.ValidationError:
      return res.status(400).send({ name, message, ...other });
    case Errors.RegistrationError:
      return res.status(404).send({ name, message, ...other });
    case Errors.ConcurrencyError:
      return res.status(409).send({ name, message, ...other });
    default:
      return res.status(500).send({ name, message });
  }
};
