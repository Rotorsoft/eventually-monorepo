import { log, Subscription, subscriptions } from "@rotorsoft/eventually";
import cluster from "cluster";
import { cpus } from "os";

export const start = async (): Promise<void> => {
  const cores = cpus().length;
  const workers: Record<number, Subscription> = {};

  log().info("green", `Broker started with ${cores} cores`);

  try {
    await subscriptions().init();
    const subs = await subscriptions().load();
    subs.map((sub) => {
      const worker = cluster.fork({ SUBSCRIPTION: JSON.stringify(sub) });
      workers[worker.id] = sub;
    });
  } catch (error) {
    log().error(error);
  }

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
};
