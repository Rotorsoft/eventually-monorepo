import { log } from "@andela-technology/eventually";
import axios from "axios";
import { OpenAPIObject, SchemaObject } from "openapi3-ts";
import { breaker } from "./breaker";
import { state } from "./cluster";
import {
  ExtendedPathItemObject,
  ExtendedSchemaObject,
  Service,
  ServiceSpec
} from "./types";

const HTTP_TIMEOUT = 5000;

// /**
//  * Loads service endpoints metadata
//  *
//  * @param service The service
//  * @returns The endpoints payload
//  */
// export const getServiceEndpoints = async (
//   service: Service
// ): Promise<Endpoints | undefined> => {
//   try {
//     const url = new URL(service.url);
//     if (!url.protocol.startsWith("http")) return undefined;
//     const { data } = await axios.get<Endpoints>(`${url.origin}/_endpoints`, {
//       timeout: HTTP_TIMEOUT
//     });
//     return data;
//   } catch (err) {
//     log().error(err);
//     return undefined;
//   }
// };

/**
 * Loads service swagger metadata
 *
 * @param service The service
 * @returns The swagger json document spec
 */
const getServiceSwagger = async (
  service: Service
): Promise<OpenAPIObject | undefined> => {
  const url = new URL(service.url);
  if (!url.protocol.startsWith("http")) return undefined;
  const secretsQueryString = state().serviceSecretsQueryString(service.id);
  const path = `${url.origin}/swagger${secretsQueryString}`;
  const { data } = await axios.get<OpenAPIObject>(path, {
    timeout: HTTP_TIMEOUT
  });
  return data;
};

const getSnapshotEvents = (schema: SchemaObject): string[] => {
  const refs = [] as string[];
  schema?.properties?.state &&
    schema?.properties?.event &&
    "anyOf" in schema?.properties?.event &&
    getRefs(schema.properties.event, refs);
  return refs;
};

const getEvent = (schema: SchemaObject): ExtendedSchemaObject | undefined =>
  schema?.properties?.name &&
  "enum" in schema.properties.name &&
  schema.properties.name.enum?.length &&
  schema?.properties?.created
    ? { ...schema, name: schema.properties.name.enum[0] }
    : undefined;

const SCHEMA = "#/components/schemas/";
const getRefs = (object: unknown, refs: string[]): void => {
  if (typeof object === "object") {
    Object.entries(object as object).forEach(([key, value]) => {
      if (key !== "$ref") getRefs(value, refs);
      else if (typeof value === "string" && value.startsWith(SCHEMA))
        refs.push(value.substring(SCHEMA.length));
    });
  }
};

const getSpec = (document: OpenAPIObject): ServiceSpec => {
  const handlers = Object.entries(document?.paths || {})
    .map(([path, methods]) =>
      Object.entries(methods as object).map(([method, operation]) => {
        if (
          method === "post" &&
          typeof operation === "object" &&
          "requestBody" in operation
        ) {
          const handler: ExtendedPathItemObject = {
            ...operation,
            path,
            refs: [] as string[]
          };
          handler.refs && getRefs(operation.requestBody, handler.refs);
          return handler;
        }
      })
    )
    .flat()
    .filter(Boolean);

  const eventSchemas = Object.assign(
    {},
    ...Object.values(document?.components?.schemas || {})
      .map((schema) => {
        const event = getEvent(schema as SchemaObject);
        return event && { ...event, refs: [] };
      })
      .filter(Boolean)
      .map((event) => (event ? { [event.name]: event } : {}))
  ) as Record<string, ExtendedSchemaObject>;

  // flag snapshot events
  Object.values(document?.components?.schemas || {})
    .map((schema) => getSnapshotEvents(schema as SchemaObject))
    .flat()
    .filter(Boolean)
    .map((name) => {
      const schema = eventSchemas[name];
      schema && (schema.inSnapshot = true);
    });

  const { commandHandlers, eventHandlers } = handlers.reduce(
    (map, handler) => {
      const found = handler?.refs?.filter((ref) => {
        const schema = eventSchemas[ref];
        schema && schema.refs?.push(handler.path);
        return schema;
      });
      handler &&
        (found?.length
          ? map.eventHandlers.push(handler)
          : map.commandHandlers.push(handler));
      return map;
    },
    {
      commandHandlers: [] as ExtendedPathItemObject[],
      eventHandlers: [] as ExtendedPathItemObject[]
    }
  );

  const allPath = Object.keys(document?.paths || {}).find(
    (path) => path === "/all"
  );

  return {
    discovered: new Date(),
    version: document.info.version,
    commandHandlers: Object.assign(
      {},
      ...commandHandlers.map((handler) => ({ [handler.path]: handler }))
    ),
    eventHandlers: Object.assign(
      {},
      ...eventHandlers.map((handler) => ({ [handler.path]: handler }))
    ),
    schemas: eventSchemas,
    allPath
  };
};

// TODO: resolve payload conflicts between producer/consumer schemas
const reduceConflicts = (
  producer: SchemaObject,
  consumer: SchemaObject,
  conflicts: string[],
  path: string
): void => {
  /*
    payload field names and types are compatible
    - consuming services can define only a subset of the producer contract
    - ignoring unused fields in producer

    - matching fields must following rules
      required
      format (specific type like guid or date-time)
      patterns (regex)
      nullable
      default values
      enum constraints
      min, max lengths
  */
  if (!producer || !consumer) return;

  if (producer.type !== consumer.type) {
    conflicts.push(`${path} => type: ${producer.type} !== ${consumer.type}`);
    return;
  }

  if (Array.isArray(producer.type)) {
    // TODO: compare arrays
  } else if (producer.type === "array") {
    // TODO: compare arrays
  } else if (producer.type === "object") {
    producer.properties &&
      Object.entries(producer.properties).forEach(([key, value]) => {
        consumer.properties &&
          reduceConflicts(
            value as SchemaObject,
            consumer.properties[key] as SchemaObject,
            conflicts,
            path.concat(key, "/")
          );
      });
  } else {
    // TODO: check primitive rules
  }
};

export const getConflicts = (event: EventContract): string[] => {
  const conflicts = [] as string[];
  const schema = event?.schema?.properties?.data;
  schema &&
    Object.values(event.consumers).forEach((consumer) => {
      consumer?.schema?.properties?.data &&
        reduceConflicts(
          schema as SchemaObject,
          consumer.schema.properties.data as SchemaObject,
          conflicts,
          consumer.id
        );
    });
  return conflicts;
};

export type EventContract = {
  name: string;
  schema?: ExtendedSchemaObject;
  producers: Record<string, string>;
  consumers: Record<
    string,
    { id: string; path: string; schema: ExtendedSchemaObject }
  >;
  conflicts?: string[];
};
const consumers: Record<string, Service> = {};
const events: Record<string, EventContract> = {};

export const getEventContract = (name: string): EventContract => events[name];

const refreshServiceEventContracts = (service: Service): void => {
  const found = Object.entries(consumers).filter(
    ([, v]) => v.id === service.id
  );
  found.forEach(([path]) => delete consumers[path]);

  service.eventHandlers &&
    Object.values(service.eventHandlers).forEach(
      (handler) => (consumers[handler.path] = service)
    );

  service.schemas &&
    Object.values(service.schemas).forEach((schema) => {
      const event = (events[schema.name] = events[schema.name] || {
        name: schema.name,
        schema,
        producers: {},
        consumers: {}
      });
      if (schema.refs && schema.refs.length) {
        schema.refs.forEach((ref) => {
          const consumer = consumers[ref];
          event.consumers[service.id] = {
            id: consumer && consumer.id,
            path: ref,
            schema
          };
        });
        if (schema.inSnapshot) event.producers[service.id] = service.id;
      } else {
        event.producers[service.id] = service.id;
        event.schema = schema;
      }
      event.conflicts = getConflicts(event);
    });
};

export const getEventContracts = (): EventContract[] => {
  return Object.values(events).sort((a, b) =>
    a.name > b.name ? 1 : a.name < b.name ? -1 : 0
  );
};

export const refreshServiceSpec = async (service: Service): Promise<void> => {
  !service.breaker &&
    (service.breaker = breaker(service.id, {
      timeout: 60000,
      failureThreshold: 2,
      successThreshold: 2
    }));
  const { data } = await service.breaker.exec<OpenAPIObject>(async () => {
    try {
      const data = await getServiceSwagger(service);
      return { data };
    } catch (err: any) {
      log().error(err);
      err.code === "ENOTFOUND" && service.breaker && service.breaker.pause();
      return { error: err.message };
    }
  });
  if (data) {
    data.info && Object.assign(service, getSpec(data));
    refreshServiceEventContracts(service);
  }
};
