import {
  Actor,
  CommittedEvent,
  Endpoints,
  log,
  Payload
} from "@rotorsoft/eventually";
import axios from "axios";
import { Request } from "express";
import { OpenAPIV3_1 } from "openapi-types";
import { ContractsViewModel } from "./cluster";
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

export const getServiceEndpoints = async (
  service: Service
): Promise<Endpoints | undefined> => {
  try {
    const url = new URL(service.url);
    if (!url.protocol.startsWith("http")) return undefined;
    const { data } = await axios.get<Endpoints>(`${url.origin}/_endpoints`, {
      timeout: HTTP_TIMEOUT
    });
    return data;
  } catch {
    return undefined;
  }
};

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

export const getServiceContracts = (
  services: Service[]
): Promise<{ services: Record<string, ContractsViewModel> }> => {
  return Promise.all(
    services.reduce((acc, service) => {
      if (!service.url.startsWith("http")) return acc;
      const contractsPromise = axios
        .get<OpenAPIV3_1.Document>(`${service.url}/swagger`, {
          timeout: HTTP_TIMEOUT
        })
        .then((response) => response.data)
        .then((apiDef) => apiDef?.components?.schemas)
        .then((schemas: Record<string, any>) => {
          return Object.keys(schemas).reduce(
            (acc, name) => {
              if (
                schemas[name]?.properties?.name &&
                schemas[name]?.properties?.id &&
                schemas[name]?.properties?.stream &&
                schemas[name]?.properties?.version &&
                schemas[name]?.properties?.created &&
                schemas[name]?.properties?.data
              )
                acc.events.push({
                  name,
                  payload: (
                    schemas[name].properties.data as OpenAPIV3_1.SchemaObject
                  ).properties,
                  service: service.id,
                  schemaDescription: schemas[name].description
                });
              else if (name.endsWith("Error"))
                acc.errors.push({ ...schemas[name], service: service.id });
              else acc.commands.push({ ...schemas[name], service: service.id });
              return acc;
            },
            { service, commands: [], events: [], errors: [] }
          );
        })
        .catch(() => undefined);
      acc.push(contractsPromise);
      return acc;
    }, [] as any[])
  ).then((contracts) => {
    return contracts
      .filter((c) => !!c)
      .reduce(
        (acc, contract) => {
          acc.services[contract.service.id] = {
            commands: contract.commands,
            events: contract.events,
            errors: contract.errors
          };
          return acc;
        },
        { services: {} } as { services: Record<string, ContractsViewModel> }
      );
  });
};

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
 * Optional callback after each action
 */
type Action = () => Promise<boolean | undefined>;
type Callback = (result: boolean | undefined) => void;
export type Loop = {
  push: (action: Action, callback?: Callback) => void;
  stop: () => Promise<void>;
  stopped: () => boolean;
};

/**
 * Loop factory
 * @param name The name of the loop
 * @returns A new loop
 */
export const loop = (name: string): Loop => {
  const queue: Array<{ action: Action; callback?: Callback }> = [];
  let running = false;
  let status: "running" | "stopping" | "stopped" = "running";

  const run = async (): Promise<void> => {
    if (!running) {
      running = true;
      while (queue.length) {
        if (status === "stopping") break;
        const { action, callback } = queue.shift();
        const result = await action();
        callback && callback(result);
      }
      status = "stopped";
      running = false;
    }
  };

  return {
    push: (action: Action, callback?: Callback): void => {
      queue.push({ action, callback });
      status = "running";
      setImmediate(run);
    },
    stop: async (): Promise<void> => {
      if (queue.length > 0) {
        status = "stopping";
        for (let i = 1; status === "stopping" && i <= 30; i++) {
          log().trace(
            "red",
            `[${process.pid}] Stopping loop [${name}] (${i})...`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    },
    stopped: () => status !== "running"
  };
};
