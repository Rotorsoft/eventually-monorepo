import { app, Subscription, subscriptions } from "@rotorsoft/eventually";
import { ExpressApp } from "@rotorsoft/eventually-express";
import {
  PostgresStreamListener,
  PostgresSubscriptionStore
} from "@rotorsoft/eventually-pg";
import cluster from "cluster";
import { start } from "./master";
import { pump } from "./pump";

subscriptions(PostgresSubscriptionStore());

if (cluster.isWorker) {
  const sub: Subscription = JSON.parse(
    process.env.SUBSCRIPTION
  ) as Subscription;
  // TODO config other listeners
  void PostgresStreamListener(sub, pump);
} else {
  void start().then(() => {
    app(new ExpressApp()).build();
    void app().listen();
  });
}
