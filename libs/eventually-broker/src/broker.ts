import cluster from "cluster";
import { Express, RequestHandler, Router } from "express";
import {
  ChannelResolvers,
  PostgresPullChannel,
  HttpPostPushChannel,
  VoidPullChannel,
  VoidPushChannel
} from ".";
import { app } from "./app";
import { CronPullChannel } from "./channels/CronPullChannel";
import { work } from "./cluster";

export const defaultResolvers: ChannelResolvers = {
  pull: {
    "void:": () => VoidPullChannel(),
    "pg:": (url: URL) => PostgresPullChannel(url),
    "cron:": (url: URL, id: string) => CronPullChannel(url, id)
  },
  push: {
    "void:": () => VoidPushChannel(),
    "http:": (url: URL) => HttpPostPushChannel(url),
    "https:": (url: URL) => HttpPostPushChannel(url)
  }
};

type Options = {
  port?: number;
  resolvers?: ChannelResolvers;
  middleware?: RequestHandler[];
  prerouters?: Array<{ path: string; router: Router }>;
};

export const broker = ({
  port,
  resolvers,
  middleware,
  prerouters
}: Options = {}): Promise<void> | Promise<Express> =>
  cluster.isWorker
    ? work({
        push: { ...defaultResolvers.push, ...resolvers.push },
        pull: { ...defaultResolvers.pull, ...resolvers.pull }
      })
    : app({ port, middleware, prerouters });
