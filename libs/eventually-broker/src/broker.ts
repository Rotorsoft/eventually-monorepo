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

export const broker = (resolvers?: ChannelResolvers): void => {
  cluster.isWorker
    ? void work({ ...defaultResolvers, ...resolvers })
    : void app();
};
