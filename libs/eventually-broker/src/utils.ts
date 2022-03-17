import { log, Payload } from "@rotorsoft/eventually";
import cluster from "cluster";
import { cpus } from "os";
import { Operation } from "./types";

export type Argument = Payload & { id: string; active: boolean };
export type State = {
  running: Record<string, Argument>;
  status: Record<string, string>;
};
export type Refresh = {
  refresh: (operation: Operation, id: string, arg?: Argument) => void;
  state: () => State;
};

export const fork = (args: Argument[]): Refresh => {
  const cores = cpus().length;
  const state: State = { running: {}, status: {} };

  log().info("green", `Cluster started with ${cores} cores`);

  const run = (arg: Argument): void => {
    if (arg.active) {
      const { id } = cluster.fork({ WORKER_ENV: JSON.stringify(arg) });
      state.running[id] = arg;
      state.status[arg.id] = "OK";
    }
  };

  cluster.on("exit", (worker, code, signal) => {
    const arg = state.running[worker.id];
    delete state.running[worker.id];
    state.status[arg.id] = signal || `Exit ${code}`;
    log().info("red", `[${worker.process.pid}] exit ${signal || code}`);
    // reload worker when active and interrupted by recoverable runtime errors
    arg && (code < 100 || signal === "SIGINT") && run(arg);
  });

  args.map((arg) => run(arg));

  return {
    refresh: (operation, id, arg) => {
      log().info("magenta", `refreshing ${operation} ${id}`);
      state.status[id] = "";
      const [workerId] = Object.entries(state.running)
        .filter(([, value]) => value.id === id)
        .map(([id]) => id);
      switch (operation) {
        case "INSERT":
          if (workerId) cluster.workers[workerId].kill("SIGINT");
          else if (arg) run(arg);
          break;
        case "UPDATE":
          if (arg) {
            if (workerId) {
              state.running[workerId] = arg;
              cluster.workers[workerId].kill("SIGINT");
            } else run(arg);
          }
          break;
        case "DELETE":
          if (workerId) cluster.workers[workerId].kill("SIGTERM");
          break;
      }
    },
    state: () => state
  };
};
