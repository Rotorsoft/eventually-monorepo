import { app } from "@rotorsoft/eventually";
import { oas31 } from "openapi3-ts";
import { getComponents, getPahts, getSecurity, getTags } from "./oas";
import { toSchema } from "./schemas";
import {
  Conflict,
  EventContract,
  ExtendedPathItemObject,
  ExtendedSchemaObject,
  ServiceSpec
} from "./types";
import { getEvent, getRefs, getSnapshotEvents, reduceConflicts } from "./specs";
import { config } from "../config";

const security = getSecurity();

/**
 * Generates OpenAPI 3.1 spec from app metadata
 * @returns the OpenAPI spec
 */
export const openAPI = (): oas31.OpenAPIObject => {
  const { service, version, description, author, license } = config;
  const allStream = app().hasStreams;
  return {
    openapi: "3.1.0",
    info: {
      title: service,
      version: version,
      description: description,
      contact: author,
      license: { name: license }
    },
    servers: [{ url: "/" }],
    tags: getTags(allStream),
    components: getComponents(allStream, security),
    paths: getPahts(allStream, security)
  };
};

/**
  Resolves schema conflicts between producer and consumer of event following these rules:
  - consumer schema can be a subset of the producer schema, ignoring extras 
  - matched fields (by name) must have:
    - compatible types including format (like guid, date-time, patterns(regex), min, max lengths )
    - required in both, or optional in consumer
    - nullable in both
    - compatible enums - producer is subset of consumer 
*/
export const getConflicts = (event: EventContract): Conflict[] => {
  const conflicts: Conflict[] = [];
  const schema = event?.schema?.properties?.data;
  schema &&
    Object.values(event.consumers).forEach((consumer) => {
      consumer?.schema?.properties?.data &&
        reduceConflicts(
          schema as oas31.SchemaObject,
          consumer.schema.properties.data as oas31.SchemaObject,
          conflicts,
          consumer.id
        );
    });
  return conflicts;
};

/**
 * Generates ServiceSpec from OpenAPI Service Schema
 * @param document the oas
 * @returns the service spec
 */
export const getServiceSpec = (document: oas31.OpenAPIObject): ServiceSpec => {
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
        const event = getEvent(schema as oas31.SchemaObject);
        return event && { ...event, refs: [] };
      })
      .filter(Boolean)
      .map((event) => (event ? { [event.name]: event } : {}))
  ) as Record<string, ExtendedSchemaObject>;

  // flag snapshot events
  Object.values(document?.components?.schemas || {})
    .map((schema) => getSnapshotEvents(schema as oas31.SchemaObject))
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

export const toJsonSchema = toSchema;
export * from "./utils";
export * from "./types";
