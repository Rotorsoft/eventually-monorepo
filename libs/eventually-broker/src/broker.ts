import cluster from "cluster";
import { RequestHandler } from "express";
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
  middleware?: RequestHandler[];
  resolvers?: ChannelResolvers;
};

export const broker = ({
  port,
  middleware,
  resolvers
}: Options = {}): void | Promise<void> =>
  cluster.isWorker
    ? work({
        push: { ...defaultResolvers.push, ...resolvers.push },
        pull: { ...defaultResolvers.pull, ...resolvers.pull }
      })
    : app({ port, middleware });
