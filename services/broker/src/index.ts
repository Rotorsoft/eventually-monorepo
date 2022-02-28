import { log, Subscription } from "@rotorsoft/eventually";
import { PostgresStreamListener } from "@rotorsoft/eventually-pg";
import cluster from "cluster";
import * as fs from "fs";
import { cpus } from "os";
import { pump } from "./pump";
import { Channels } from "./types";

const getChannels = (): Channels => {
  const channels = fs.readFileSync("./channels.json");
  return JSON.parse(channels.toString()) as unknown as Channels;
};

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
  const channels = getChannels();
  Object.entries(channels).map(([name, channel]) => {
    channel.subscriptions.map((sub) => {
      sub.channel = name;
      const worker = cluster.fork({ SUBSCRIPTION: JSON.stringify(sub) });
      workers[worker.id] = sub;
    });
  });
  cluster.on("exit", (worker, code, signal) => {
    const sub = workers[worker.id];
    delete workers[worker.id];
    if (signal) {
      log().info(
        "red",
        `Worker ${worker.process.pid} was killed by signal: ${signal}`
      );
    } else if (code) {
      log().info(
        "red",
        `Worker ${worker.process.pid} exited with error code: ${code}. Reloading...`
      );
      const new_worker = cluster.fork({ SUBSCRIPTION: JSON.stringify(sub) });
      workers[new_worker.id] = sub;
    }
  });
}
