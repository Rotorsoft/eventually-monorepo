import cluster from "cluster";
import { cpus } from "os";
import { work } from "./pg-listener";
import { log, Subscription } from "@rotorsoft/eventually";

// TODO get this from config
const subscriptions: Subscription[] = [
  {
    channel: "calculator",
    match: {
      streams: "^Calculator-.+$",
      names: "^DigitPressed|DotPressed|EqualsPressed$"
    },
    endpoint: `http://localhost:3000/counter`
  },
  {
    channel: "calculator",
    match: {
      streams: "^Calculator-.+$",
      names: "^DigitPressed|DotPressed|EqualsPressed$"
    },
    endpoint: `http://localhost:3000/stateless-counter`
  }
];

if (cluster.isWorker) void work();
else {
  const cores = cpus().length;
  const subs: Record<number, Subscription> = {};

  log().info("green", `Broker started with ${cores} cores`);
  for (const sub of subscriptions) {
    const worker = cluster.fork({ SUBSCRIPTION: JSON.stringify(sub) });
    subs[worker.id] = sub;
  }
  cluster.on("exit", (worker, code, signal) => {
    const sub = subs[worker.id];
    delete subs[worker.id];
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
      subs[new_worker.id] = sub;
    }
  });
}
