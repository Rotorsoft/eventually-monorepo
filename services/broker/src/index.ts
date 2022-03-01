import { log, Subscription, subscriptions } from "@rotorsoft/eventually";
import {
  PostgresStreamListener,
  PostgresSubscriptionStore
} from "@rotorsoft/eventually-pg";
import cluster from "cluster";
import { cpus } from "os";
import { pump } from "./pump";

subscriptions(PostgresSubscriptionStore());
void subscriptions().init();

if (cluster.isWorker) {
  const sub: Subscription = JSON.parse(
    process.env.SUBSCRIPTION
  ) as Subscription;
  // TODO config other listeners
  if (sub) void PostgresStreamListener(sub, pump);
} else {
  const cores = cpus().length;
  const workers: Record<number, Subscription> = {};

  log().info("green", `Broker started with ${cores} cores`);
  void subscriptions()
    .load()
    .then((subs) =>
      subs.map((sub) => {
        const worker = cluster.fork({ SUBSCRIPTION: JSON.stringify(sub) });
        workers[worker.id] = sub;
      })
    )
    .catch((error: Error) => log().error(error));

  cluster.on("exit", (worker, code, signal) => {
    const sub = workers[worker.id];
    delete workers[worker.id];
    if (signal) {
      log().info("red", `[${worker.process.pid}] killed by signal: ${signal}`);
    } else if (code) {
      log().info(
        "red",
        `[${worker.process.pid}] exit with error code: ${code}. reloading...`
      );
      const new_worker = cluster.fork({ SUBSCRIPTION: JSON.stringify(sub) });
      workers[new_worker.id] = sub;
    }
  });
}
