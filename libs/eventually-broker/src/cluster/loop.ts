import { log } from "@rotorsoft/eventually";

/**
 * Loops are infinite FIFO queues of async actions executed sequentially
 * Loops are started/restarted by pushing new actions to it
 * Loops can also be stopped
 * Optional callback after action is completed
 * Optional delay before action is enqueued
 */
type Action = {
  id: string;
  action: () => Promise<boolean | undefined>;
  callback?: (id: string, result: boolean | undefined) => void;
  delay?: number;
};

export type Loop = {
  push: (action: Action) => void;
  stop: () => Promise<void>;
  stopped: () => boolean;
};

/**
 * Loop factory
 * @param name The name of the loop
 * @returns A new loop
 */
export const loop = (name: string): Loop => {
  const queue: Array<Action> = [];
  let pending: Record<string, NodeJS.Timeout> = {};
  let running = false;
  let status: "running" | "stopping" | "stopped" = "running";

  const push = (action: Action): void => {
    queue.push(action);
    status = "running";
    setImmediate(run);
  };

  const run = async (): Promise<void> => {
    if (!running) {
      running = true;
      while (queue.length) {
        if (status === "stopping") break;
        const action = queue.shift();
        if (action) {
          const result = await action.action();
          action.callback && action.callback(action.id, result);
        }
      }
      status = "stopped";
      running = false;
    }
  };

  return {
    push: (action: Action): void => {
      if (action.delay) {
        pending[action.id] && clearTimeout(pending[action.id]);
        pending[action.id] = setTimeout(() => {
          delete pending[action.id];
          push(action);
        }, action.delay);
      } else push(action);
    },
    stop: async (): Promise<void> => {
      if (queue.length > 0 && status === "running") {
        status = "stopping";
        for (let i = 1; status === "stopping" && i <= 30; i++) {
          log()
            .red()
            .trace(`[${process.pid}] Stopping loop [${name}] (${i})...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      // reset on stop
      queue.length = 0;
      Object.values(pending).forEach((timeout) => clearTimeout(timeout));
      pending = {};
    },
    stopped: () => status !== "running"
  };
};
