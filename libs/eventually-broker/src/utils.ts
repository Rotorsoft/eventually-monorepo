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
import { ContractsViewModel, ExtendedSchemaObject } from "./cluster";
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
 * Loads service endpoints metadata
 *
 * @param service The service
 * @returns The endpoints payload
 */
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
  } catch (err) {
    log().error(err);
    return undefined;
  }
};

/**
 * Loads service swagger metadata
 *
 * @param service The service
 * @returns The endpoints payload
 */
export const getServiceSwagger = async (
  service: Service
): Promise<OpenAPIV3_1.Document | undefined> => {
  try {
    const url = new URL(service.url);
    if (!url.protocol.startsWith("http")) return undefined;
    const { data } = await axios.get<OpenAPIV3_1.Document>(
      `${url.origin}/swagger`,
      {
        timeout: HTTP_TIMEOUT
      }
    );
    return data;
  } catch (err) {
    log().error(err);
    return undefined;
  }
};

const getEvent = (
  schema: OpenAPIV3_1.SchemaObject
): ExtendedSchemaObject | undefined =>
  schema?.properties?.name &&
  "enum" in schema?.properties?.name &&
  schema?.properties?.created &&
  schema?.properties?.data &&
  "properties" in schema?.properties?.data
    ? { ...schema, name: schema.properties.name.enum[0] }
    : undefined;

const getRefs = (object: unknown, refs: string[]): void => {
  if (typeof object === "object") {
    Object.entries(object).forEach(([key, value]) => {
      if (key !== "$ref") getRefs(value, refs);
      else if (typeof value === "string") refs.push(value);
    });
  }
};

const SCHEMA = "#/components/schemas/";
const getSchemas = (swagger: OpenAPIV3_1.Document): ContractsViewModel => {
  const postRefs: Record<string, string[]> = {};
  Object.entries(swagger?.paths || {}).map(([path, methods]) => {
    return Object.entries(methods).map(([method, operation]) => {
      if (
        method === "post" &&
        typeof operation === "object" &&
        "requestBody" in operation
      ) {
        // just find #ref properties inside this body
        postRefs[path] = [];
        return getRefs(operation.requestBody, postRefs[path]);
      }
    });
  });
  const schemaRefs = Object.entries(postRefs).reduce((acc, [path, refs]) => {
    refs.forEach((ref) => {
      if (ref.startsWith(SCHEMA)) {
        const schema = ref.substring(SCHEMA.length);
        acc[schema] = acc[schema] || [];
        acc[schema].push(path);
      }
    });
    return acc;
  }, {} as Record<string, string[]>);

  return Object.values(swagger?.components?.schemas || {}).reduce(
    (acc, schema) => {
      const event = getEvent(schema);
      event && acc.events.push({ ...event, refs: schemaRefs[event.name] });
      return acc;
    },
    { events: [] as Array<ExtendedSchemaObject> }
  );
};

/**
 * Loads service contract metadata
 * @param services The services
 * @returns The contracts
 */
export const getServiceContracts = async (
  services: Service[]
): Promise<Record<string, ContractsViewModel>> => {
  const swaggers = await Promise.all(
    services.map(async (service) => {
      const document = await getServiceSwagger(service);
      return { service, document };
    })
  );
  return swaggers.filter(Boolean).reduce((acc, swagger) => {
    acc[swagger.service.id] = getSchemas(swagger.document);
    return acc;
  }, {} as Record<string, ContractsViewModel>);
};

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
