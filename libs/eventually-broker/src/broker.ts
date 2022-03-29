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

const defaultResolvers: ChannelResolvers = {
  pull: {
    "void:": () => VoidPullChannel(),
    "pg:": (id: string, channel: URL) => PostgresPullChannel(id, channel)
  },
  push: {
    "void:": () => VoidPushChannel(),
    "http:": (_, endpoint: URL) => HttpPostPushChannel(endpoint),
    "https:": (_, endpoint: URL) => HttpPostPushChannel(endpoint)
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
  cluster.isWorker ? work({ ...defaultResolvers, ...resolvers }) : app(port);
