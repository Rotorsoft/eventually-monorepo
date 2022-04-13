import cluster from "cluster";
import {
  ChannelResolvers,
  PostgresPullChannel,
  HttpPostPushChannel,
  VoidPullChannel,
  VoidPushChannel
} from ".";
import { app } from "./app";
import { work } from "./cluster";

export const defaultResolvers: ChannelResolvers = {
  pull: {
    "void:": () => VoidPullChannel(),
    "pg:": (url: URL) => PostgresPullChannel(url)
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
};

export const broker = ({
  port,
  resolvers
}: Options = {}): void | Promise<void> =>
  cluster.isWorker
    ? work({
        push: { ...defaultResolvers.push, ...resolvers.push },
        pull: { ...defaultResolvers.pull, ...resolvers.pull }
      })
    : app(port);
