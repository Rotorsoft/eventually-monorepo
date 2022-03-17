import cluster from "cluster";
import { ChannelResolvers, StreamListenerFactory } from ".";
import { app } from "./app";
import { work } from "./worker";

export const broker = (
  subscriptionsListenerFactory: StreamListenerFactory,
  resolvers: ChannelResolvers
): void => {
  cluster.isWorker
    ? void work(resolvers)
    : void app(subscriptionsListenerFactory);
};
