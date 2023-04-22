import { oas31 } from "openapi3-ts";
import { Conflict, ExtendedSchemaObject } from "./types";

export const getSnapshotEvents = (schema: oas31.SchemaObject): string[] => {
  const refs = [] as string[];
  schema?.properties?.state &&
    schema?.properties?.event &&
    "anyOf" in schema.properties.event &&
    getRefs(schema.properties.event, refs);
  return refs;
};

export const getEvent = (
  schema: oas31.SchemaObject
): ExtendedSchemaObject | undefined =>
  schema?.properties?.name &&
  "enum" in schema.properties.name &&
  schema.properties.name.enum?.length &&
  schema?.properties?.created
    ? { ...schema, name: schema.properties.name.enum[0] }
    : undefined;

const SCHEMA = "#/components/schemas/";
export const getRefs = (object: unknown, refs: string[]): void => {
  if (typeof object === "object") {
    Object.entries(object as object).forEach(([key, value]) => {
      if (key !== "$ref") getRefs(value, refs);
      else if (typeof value === "string" && value.startsWith(SCHEMA))
        refs.push(value.substring(SCHEMA.length));
    });
  }
};

export const reduceConflicts = (
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
