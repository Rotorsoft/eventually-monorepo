import { generateSchema } from "@anatine/zod-openapi";
import { Errors, Payload, Schema } from "@andela-technology/eventually";
import * as fs from "fs";
import j2s from "joi-to-swagger";
import {
  ComponentsObject,
  SchemaObject,
  SecuritySchemeObject
} from "openapi3-ts";
import z from "zod";

type Security = {
  schemes: Record<string, SecuritySchemeObject>;
  operations: Record<string, Array<any>>;
};

export const getSecurity = (): Security => {
  try {
    const sec = fs.readFileSync("security.json");
    return JSON.parse(sec.toString()) as Security;
  } catch {
    return {
      schemes: {},
      operations: {}
    };
  }
};

export const getComponents = (sec: Security): ComponentsObject => ({
  parameters: {
    id: {
      in: "path",
      name: "id",
      description: "Reducible Id",
      schema: { type: "string" },
      required: true
    },
    stream: {
      in: "query",
      name: "stream",
      description: "Filter by stream name",
      schema: { type: "string" }
    },
    names: {
      in: "query",
      name: "names",
      description: "Filter by event names",
      schema: { type: "array", items: { type: "string" } }
    },
    after: {
      in: "query",
      name: "after",
      description: "Get all stream after this event id",
      schema: { type: "integer", default: -1 }
    },
    limit: {
      in: "query",
      name: "limit",
      description: "Max number of events to query",
      schema: { type: "integer", default: 1 }
    },
    before: {
      in: "query",
      name: "before",
      description: "Get all stream before this event id",
      schema: { type: "integer" }
    },
    created_after: {
      in: "query",
      name: "created_after",
      description: "Get all stream created after this date/time",
      schema: { type: "string", format: "date-time" }
    },
    created_before: {
      in: "query",
      name: "created_before",
      description: "Get all stream created before this date/time",
      schema: { type: "string", format: "date-time" }
    }
  },
  securitySchemes: sec.schemes,
  schemas: {
    ValidationError: generateSchema(
      z.object({
        message: z.enum([Errors.ValidationError]),
        details: z.array(z.string())
      })
    ),
    RegistrationError: generateSchema(
      z.object({
        message: z.enum([Errors.RegistrationError]),
        details: z.string()
      })
    ),
    ConcurrencyError: generateSchema(
      z.object({
        message: z.enum([Errors.ConcurrencyError]),
        lastVersion: z.number().int(),
        events: z.array(
          z.object({
            name: z.string(),
            data: z.object({})
          })
        ),
        expectedVersion: z.number().int()
      })
    ),
    StoreStats: generateSchema(
      z.array(
        z.object({
          name: z.string(),
          count: z.number().int(),
          firstId: z.number().int(),
          lastId: z.number().int(),
          firstCreated: z.date(),
          lastCreated: z.date()
        })
      )
    ),
    CommittedEvent: generateSchema(
      z.object({
        name: z.string(),
        id: z.number().int(),
        stream: z.string(),
        version: z.number().int(),
        created: z.date(),
        data: z.object({}).optional()
      })
    ),
    PolicyResponse: generateSchema(
      z.object({
        command: z
          .object({
            name: z.string(),
            data: z.object({}).optional(),
            id: z.string().optional(),
            expectedVersion: z.number().int().optional(),
            actor: z
              .object({
                name: z.string(),
                roles: z.array(z.string())
              })
              .optional()
          })
          .optional(),
        state: z.object({}).optional()
      })
    )
  }
});

export const CommittedEventSchema = <T extends Payload>(
  name: string,
  schema?: Schema<T>
): SchemaObject => {
  const committedEventSchema = generateSchema(
    z.object({
      name: z.enum([name]),
      id: z.number().int(),
      stream: z.string(),
      version: z.number().int(),
      created: z.date()
    })
  );
  schema &&
    committedEventSchema.properties &&
    (committedEventSchema.properties["data"] = toOpenAPISchema(schema));
  return committedEventSchema;
};

/**
 * Converts generic schemas (`joi`, `zod`) into OpenAPI Spec 3.1 SchemaObject
 *
 * @param schema the generic schema
 * @param existingComponets optional existing swagger components
 * @returns OpenAPI Schema Object
 */
export const toOpenAPISchema = <T extends Payload>(
  schema: Schema<T>,
  existingComponets?: ComponentsObject
): SchemaObject => {
  if ("validate" in schema) {
    const description = schema?._flags?.description;
    description && (schema._flags.description = undefined);
    const { swagger } = j2s(schema, existingComponets);
    swagger.description = description;
    return swagger;
  } else {
    const result = generateSchema(schema);
    result.description = schema.description;
    return result;
  }
};
