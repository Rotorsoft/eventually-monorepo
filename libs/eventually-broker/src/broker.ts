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
    "http:": (
      url: URL,
      id: string,
      source: string,
      headers?: Record<string, unknown>
    ) => HttpPostPushChannel(url, headers),
    "https:": (
      url: URL,
      id: string,
      source: string,
      headers?: Record<string, unknown>
    ) => HttpPostPushChannel(url, headers)
  }
};

export const broker = async (
  options: AppOptions = { subscriptionStoreFactory: PostgresSubscriptionStore }
): Promise<Express | undefined> => {
  subscriptions(options.subscriptionStoreFactory());
  options.resolvers = {
    push: { ...defaultResolvers.push, ...options?.resolvers?.push },
    pull: { ...defaultResolvers.pull, ...options?.resolvers?.pull }
  };
  if (cluster.isWorker) await work(options);
  else return app(options);
};
