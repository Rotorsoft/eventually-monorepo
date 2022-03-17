import { log, Payload } from "@rotorsoft/eventually";
import cluster from "cluster";
import { cpus } from "os";
import { Operation, TriggerPayload } from "./types";

export type Argument = Payload & { id: string; active: boolean };
export type State = {
  running: Record<string, Argument>;
  status: Record<string, { code: string; error: string }>;
  stats: Record<string, any>;
};
export type Refresh = {
  refresh: (operation: Operation, id: string, arg?: Argument) => void;
  state: () => State;
};

export const fork = (args: Argument[]): Refresh => {
  const cores = cpus().length;
  const state: State = { running: {}, status: {}, stats: {} };

  log().info("green", `Cluster started with ${cores} cores`);

  const run = (arg: Argument): void => {
    if (arg.active) {
      const { id } = cluster.fork({ WORKER_ENV: JSON.stringify(arg) });
      state.running[id] = arg;
      state.status[arg.id] = { code: "OK", error: "" };
      state.stats[arg.id] = undefined;
    }
  };

  cluster.on(
    "message",
    (
      worker,
      msg: {
        error?: string;
        id?: string;
        trigger?: TriggerPayload;
        stats?: any;
      }
    ) => {
      if (msg.error) {
        const runner = state.running[worker.id];
        runner && (state.status[runner.id].error = msg.error);
      } else if (msg.id && msg.stats) {
        state.stats[msg.id] = msg.stats;
      }
    }
  );

  cluster.on("exit", (worker, code, signal) => {
    const arg = state.running[worker.id];
    delete state.running[worker.id];
    state.status[arg.id].code = signal || `Exit ${code}`;
    log().info("red", `[${worker.process.pid}] exit ${signal || code}`);
    // reload worker when active and interrupted by recoverable runtime errors
    arg && (code < 100 || signal === "SIGINT") && run(arg);
  });

  args.map((arg) => run(arg));

  return {
    refresh: (operation, id, arg) => {
      log().info("magenta", `refreshing ${operation} ${id}`);
      state.status[id] = { code: "", error: "" };
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
