import { generateSchema } from "@anatine/zod-openapi";
import { app, ArtifactMetadata, Errors, ZodEmpty } from "@rotorsoft/eventually";
import * as fs from "fs";
import {
  ComponentsObject,
  ResponseObject,
  SchemaObject,
  SecuritySchemeObject
} from "openapi3-ts";
import z, { ZodType } from "zod";

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
        name: z.enum([Errors.ValidationError]),
        message: z.string().min(1),
        details: z.array(z.string())
      })
    ),
    RegistrationError: generateSchema(
      z.object({
        name: z.enum([Errors.RegistrationError]),
        message: z.string().min(1)
      })
    ),
    ConcurrencyError: generateSchema(
      z.object({
        name: z.enum([Errors.ConcurrencyError]),
        message: z.string().min(1),
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
    )
  }
});

export const SnapshotSchema = (
  name: string,
  events: string[]
): SchemaObject => {
  return {
    type: "object",
    properties: {
      event: {
        anyOf: events.map((event) => ({
          $ref: `#/components/schemas/${event}`
        }))
      },
      state: { $ref: `#/components/schemas/${name}` }
    }
  };
};

export const PolicyResponseSchema = (commands: string[]): ResponseObject => {
  const reducibles = commands.reduce((p, c) => {
    const cmd = app().messages[c];
    if (cmd && cmd.type === "command")
      cmd.handlers.forEach((h) => {
        const artifact = app().artifacts[h];
        artifact.type === "aggregate" && (p[h] = artifact);
      });
    return p;
  }, {} as Record<string, ArtifactMetadata>);
  return {
    description: `Optional response from ${commands.join(",")}`,
    content: {
      "application/json": {
        schema: {
          anyOf: Object.keys(reducibles).map((name) => ({
            $ref: `#/components/schemas/${name}Snapshot`
          }))
        }
      }
    }
  };
};

export const CommittedEventSchema = (
  name: string,
  schema: ZodType
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
  schema !== ZodEmpty &&
    committedEventSchema.properties &&
    (committedEventSchema.properties["data"] = toOpenAPISchema(schema));
  return committedEventSchema;
};

/**
 * Converts zod schemas into OpenAPI Spec 3.1 SchemaObject
 *
 * @param schema the zod type
 * @param existingComponets optional existing swagger components
 * @returns OpenAPI Schema Object
 */
export const toOpenAPISchema = (schema: ZodType): SchemaObject => {
  const result = generateSchema(schema);
  result.description = schema.description;
  return result;
};
