import { log, Payload } from "@rotorsoft/eventually";
import cluster from "cluster";
import { cpus } from "os";
import { state, WorkerStatus } from "./state";
import { Operation, Props, Subscription } from "./types";

export type Argument = Payload & { id: string; active: boolean };
export type Refresh = (
  operation: Operation,
  id: string,
  arg?: Argument
) => void;

export const mapProps = (
  sub: Subscription,
  { exitStatus, error, stats, maxTriggerPosition }: WorkerStatus
): Props => ({
  id: sub.id,
  active: sub.active,
  exitStatus: sub.active ? exitStatus : "Inactive",
  error,
  color: !sub.active ? "secondary" : exitStatus ? "danger" : "success",
  icon: !sub.active || exitStatus || error ? "bi-cone-striped" : "bi-activity",
  position: stats.position,
  maxTriggerPosition,
  total: stats.total,
  events: Object.entries(stats.events).map(([key, value]) => ({
    name: key,
    ok: value[200],
    ignored: value[204],
    errors: Object.entries(value)
      .filter(([k]) => k !== "200" && k !== "204")
      .reduce((p, [, v]) => p + v, 0)
  }))
});

export const props = (sub: Subscription): Props => {
  const s: WorkerStatus = state().get(sub.id) || {
    exitStatus: "",
    error: "",
    stats: {
      id: sub.id,
      trigger: { id: "", operation: "RESTART" },
      position: sub.position,
      batches: 0,
      total: 0,
      events: {}
    },
    maxTriggerPosition: -1
  };
  return mapProps(sub, s);
};

export const fork = (args: Argument[]): Refresh => {
  const cores = cpus().length;

  log().info("green", `Cluster started with ${cores} cores`);

  const run = (arg: Argument): void => {
    if (arg.active) {
      const { id } = cluster.fork({ WORKER_ENV: JSON.stringify(arg) });
      state().reset(id, arg);
    }
  };

  cluster.on(
    "message",
    (
      worker,
      msg: {
        error?: string;
        stats?: any;
      }
    ) => {
      msg.error && state().error(worker.id, msg.error);
      msg.stats && state().stats(worker.id, msg.stats);
    }
  );

  cluster.on("exit", (worker, code, signal) => {
    const arg = state().exit(worker.id, code, signal);
    log().info("red", `[${worker.process.pid}] exit ${signal || code}`);
    // reload worker when active and interrupted by recoverable runtime errors
    arg && (code < 100 || signal === "SIGINT") && run(arg);
  });

  args.map((arg) => run(arg));

  return (operation, id, arg) => {
    log().info("magenta", `refreshing ${operation} ${id}`);
    const workerId = state().findWorkerId(id);
    switch (operation) {
      case "INSERT":
        if (workerId) cluster.workers[workerId].kill("SIGINT");
        else if (arg) run(arg);
        break;
      case "UPDATE":
        if (arg) {
          if (workerId) {
            state().reset(workerId, arg);
            cluster.workers[workerId].kill("SIGINT");
          } else run(arg);
        }
        break;
      case "DELETE":
        if (workerId) cluster.workers[workerId].kill("SIGTERM");
        break;
    }
  };
};
