import { Disposable } from "./interfaces";
import { log } from "./ports";
import { sleep } from "./utils";

/**
 * Scheduler statuses
 */
export type Status = "running" | "stopping" | "stopped";

/**
 * Scheduler actions
 */
export type Action = {
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
  const delayed = new Map<string, NodeJS.Timeout>();
  let status: Status = "stopped";

  log().green().trace(`Schedule "${name}" created`);

  const schedule = (action: Action): void => {
    if (status === "stopping") return;
    clearTimeout(delayed.get(action.id));
    delayed.set(
      action.id,
      setTimeout(() => {
        delayed.delete(action.id);
        enqueue(action);
      }, action.delay)
    );
  };

  const enqueue = (action: Action): void => {
    if (status === "stopping") return;
    queue.push(action);
    setImmediate(dequeue);
  };

  const dequeue = async (): Promise<void> => {
    if (status === "stopping") return;
    status = "running";
    while (queue.length && status === "running") {
      const action = queue.shift();
      if (action) {
        const result = await action.action();
        action.callback && action.callback(action.id, result);
      }
    }
    status = "stopped";
  };

  const stop = async (): Promise<void> => {
    if (status === "stopping") return;
    status = "stopping";
    delayed.forEach((timeout) => clearTimeout(timeout));
    delayed.clear();
    for (
      let attempt = 1;
      queue.length && status === "stopping" && attempt <= 10;
      attempt++
    ) {
      log()
        .red()
        .trace(
          `Schedule "${name}" - ${status} [${queue.length}] (${attempt})...`
        );
      await sleep(1000);
    }
    queue.length = 0;
    status = "stopped";
  };

  return {
    name,
    dispose: stop,
    push: (action: Action): void => {
      action.delay ? schedule(action) : enqueue(action);
    },
    stop,
    status: () => status,
    pending: () => delayed.size
  };
};
