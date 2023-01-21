import { log } from "./ports";

type Status = "running" | "stopping" | "stopped";
type Action = {
  id: string;
  action: () => Promise<boolean | undefined>;
  callback?: (id: string, result: boolean | undefined) => void;
  delay?: number;
};

/**
 * Schedules are FIFO queues of async actions executed sequentially
 * Schedules can be:
 *  - Started/Restarted - by pushing new actions, with optional callback and delay
 *  - Stopped
 */
export type Schedule = {
  push: (action: Action) => void;
  stop: () => Promise<void>;
  status: () => Status;
};

/**
 * Schedule factory
 * @param name The name of the schedule
 * @returns A new schedule
 */
export const scheduler = (name: string): Schedule => {
  const queue: Array<Action> = [];
  let pending: Record<string, NodeJS.Timeout> = {};
  let status: Status = "running";
  let breakIt = false;

  log().green().trace(`Schedule [${name}] created`);

  const push = (action: Action): void => {
    queue.push(action);
    setImmediate(run);
  };

  const run = async (): Promise<void> => {
    if (status !== "stopping") {
      status = "running";
      while (queue.length) {
        if (breakIt) break;
        const action = queue.shift();
        if (action) {
          const result = await action.action();
          action.callback && action.callback(action.id, result);
        }
      }
      status = "stopped";
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
        breakIt = true;
        status = "stopping";
        for (let i = 1; status === "stopping" && i <= 30; i++) {
          log().red().trace(`Stopping schedule [${name}] (${i})...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      // reset on stop
      queue.length = 0;
      Object.values(pending).forEach((timeout) => clearTimeout(timeout));
      pending = {};
      breakIt = false;
    },
    status: () => status
  };
};
