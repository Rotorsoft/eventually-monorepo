import { Disposable } from "./interfaces";
import { log } from "./ports";
import { sleep } from "./utils";

type Status = "running" | "stopping" | "stopped";
type Action = {
  id: string;
  action: () => Promise<boolean | undefined>;
  callback?: (id: string, result: boolean | undefined) => void;
  delay?: number;
};

/**
 * Schedules are queues of async actions that need to be executed sequentially
 * - Actions can be queued immediately or with a delay, callbacks inform when the action has been completed
 * - Action ids are unique, rescheduling cancels any pending actions with the same id
 * - A schedule rotates around `stopped` -> `running` -> `stopping` -> `stopped` -> ...
 * - You can `push` actions to a `stopped` or `running` schedule
 * - You can `stop` a `running` schedule, or it stops automatically when the queue is empty
 */
export interface Schedule extends Disposable {
  push: (action: Action) => void;
  stop: () => Promise<void>;
  status: () => Status;
  pending: () => number;
}

/**
 * Schedule factory
 * @param name The name of the schedule
 * @returns A new schedule
 */
export const scheduler = (name: string): Schedule => {
  const queue: Array<Action> = [];
  const delayed: Record<string, NodeJS.Timeout> = {};
  let status: Status = "stopped";

  log().green().trace(`Schedule "${name}" created`);

  const schedule = (action: Action): void => {
    delayed[action.id] && clearTimeout(delayed[action.id]);
    delayed[action.id] = setTimeout(() => {
      delete delayed[action.id];
      enqueue(action);
    }, action.delay);
  };

  const enqueue = (action: Action): void => {
    queue.push(action);
    status === "stopped" && setImmediate(dequeue);
  };

  const dequeue = async (): Promise<void> => {
    if (status !== "stopping") {
      status = "running";
      while (queue.length && status === "running") {
        const action = queue.shift();
        if (action) {
          const result = await action.action();
          action.callback && action.callback(action.id, result);
        }
      }
      status = "stopped";
    }
  };

  const stop = async (): Promise<void> => {
    if (status === "running") {
      status = "stopping";
      const ids = Object.entries(delayed).map(([id, timeout]) => {
        clearTimeout(timeout);
        return id;
      });
      ids.forEach((id) => delete delayed[id]);
      for (let i = 1; status === "stopping" && i <= 30; i++) {
        log().red().trace(`Stopping schedule "${name}" (${i})...`);
        await sleep(1000);
      }
      queue.length = 0;
    }
  };

  return {
    name,
    dispose: stop,
    push: (action: Action): void => {
      if (status !== "stopping")
        action.delay ? schedule(action) : enqueue(action);
    },
    stop,
    status: () => status,
    pending: () => Object.keys(delayed).length
  };
};
