import { oas31 } from "openapi3-ts";
import {
  Conflict,
  EventContract,
  ExtendedPathItemObject,
  ExtendedSchemaObject,
  ServiceSpec
} from "./types";

const getSnapshotEvents = (schema: oas31.SchemaObject): string[] => {
  const refs = [] as string[];
  schema?.properties?.state &&
    schema?.properties?.event &&
    "anyOf" in schema.properties.event &&
    getRefs(schema.properties.event, refs);
  return refs;
};

const getEvent = (
  schema: oas31.SchemaObject
): ExtendedSchemaObject | undefined =>
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

export const getSpec = (document: oas31.OpenAPIObject): ServiceSpec => {
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

const reduceConflicts = (
  producer: oas31.SchemaObject,
  consumer: oas31.SchemaObject,
  conflicts: Conflict[],
  path: string
): void => {
  if (!producer || !consumer) return;

  if (producer.type !== consumer.type) {
    conflicts.push({
      path,
      producer: producer.type?.toString(),
      consumer: consumer.type?.toString(),
      conflict: "Different types"
    });
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
            value as oas31.SchemaObject,
            consumer.properties[key] as oas31.SchemaObject,
            conflicts,
            path.concat(key, ".")
          );
      });
  } else {
    // TODO: check primitive rules
  }
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
