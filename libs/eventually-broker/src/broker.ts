import cluster from "cluster";
import { Express } from "express";
import {
  ChannelResolvers,
  PostgresPullChannel,
  HttpPostPushChannel,
  VoidPullChannel,
  VoidPushChannel,
  AppOptions
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

export const broker = async (
  options: AppOptions & {
    resolvers?: ChannelResolvers;
  } = {}
): Promise<Express> | undefined => {
  if (cluster.isWorker)
    await work({
      push: { ...defaultResolvers.push, ...options.resolvers.push },
      pull: { ...defaultResolvers.pull, ...options.resolvers.pull }
    });
  else return app(options);
};
