import cluster from "cluster";
import { Express } from "express";
import {
  ChannelResolvers,
  PostgresPullChannel,
  HttpPostPushChannel,
  VoidPullChannel,
  VoidPushChannel,
  AppOptions,
  PostgresSubscriptionStore,
  subscriptions
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
  options: AppOptions = { subscriptionStoreFactory: PostgresSubscriptionStore }
): Promise<Express> | undefined => {
  subscriptions(options.subscriptionStoreFactory());
  options.resolvers = {
    push: { ...defaultResolvers.push, ...options?.resolvers?.push },
    pull: { ...defaultResolvers.pull, ...options?.resolvers?.pull }
  };
  if (cluster.isWorker) await work(options.resolvers);
  else return app(options);
};
