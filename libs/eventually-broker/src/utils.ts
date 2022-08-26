import { Actor, CommittedEvent, log, Payload } from "@rotorsoft/eventually";
import axios from "axios";
import { Request } from "express";
import { Service } from "./types";

const usnf = new Intl.NumberFormat("en-US");
const usdf = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short"
});

export const formatInt = (int: number): string => {
  try {
    usnf.format(int);
  } catch {
    return "-";
  }
};

export const formatDate = (date: Date): string => {
  try {
    return usdf.format(date);
  } catch {
    return "-";
  }
};

/**
 * Validates admin user
 *
 * @param req Request payload
 * @returns boolean when is an Admin
 */
export const isAdmin = (req: Request): boolean | undefined => {
  const { user } = req as Request & { user: Actor };
  return user && user?.roles?.includes("admin");
};

const HTTP_TIMEOUT = 5000;

/**
 * Correlation types
 */
type CorrelationMessage = {
  name: string;
  id: number | string;
  stream?: string;
  actor?: string;
};
type Correlation = CorrelationMessage & {
  created: Date;
  service: string;
  causation?: CorrelationMessage;
};
/**
 * Gets correlation metadata
 * @param correlation The correlation id
 * @param services The services to search
 * @returns The correlation metadata
 */
export const getCorrelation = async (
  correlation: string,
  services: Service[]
): Promise<Correlation[]> => {
  const all = await Promise.all(
    services.map(async (s) => {
      if (!s.url.startsWith("http"))
        return [
          {
            created: new Date(),
            service: s.id,
            id: -1,
            name: "Invalid Service"
          }
        ];
      try {
        const { data } = await axios.get<CommittedEvent<string, Payload>[]>(
          `${s.url}/all?correlation=${correlation}&limit=10`,
          { timeout: HTTP_TIMEOUT }
        );
        return data.map(({ id, name, stream, created, metadata }) => {
          const { command, event } = metadata.causation;
          return {
            created: new Date(created),
            service: s.id,
            id,
            name,
            stream,
            causation: event
              ? {
                  name: event.name,
                  id: event.id,
                  stream: event.stream
                }
              : { name: command.name, id: command.id }
          };
        });
      } catch (error) {
        return [
          { created: new Date(), service: s.id, id: -1, name: error.message }
        ];
      }
    })
  );
  return all.flat().sort((a, b) => a.created.getTime() - b.created.getTime());
};

/**
 * Ensures argument is returned as an array
 * @param anyOrArray The argument
 * @returns The ensured array
 */
export const ensureArray = (anyOrArray: any | any[]): any[] =>
  Array.isArray(anyOrArray) ? anyOrArray : [anyOrArray];

// export const safeStringify = (val: any): string => {
//   let cache: Array<any> = [];
//   const result = JSON.stringify(
//     val,
//     (key, value) =>
//       typeof value === "object" && value !== null
//         ? cache.includes(value)
//           ? `circular:${key}`
//           : cache.push(value) && value
//         : value,
//     2
//   );
//   cache = null;
//   return result;
// };

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
        const { id, action, callback } = queue.shift();
        const result = await action();
        callback && callback(id, result);
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
          log().trace(
            "red",
            `[${process.pid}] Stopping loop [${name}] (${i})...`
          );
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
