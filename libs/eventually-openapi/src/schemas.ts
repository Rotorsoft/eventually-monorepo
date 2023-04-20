import { Errors, ReducibleFactory, ZodEmpty, app } from "@rotorsoft/eventually";
import { oas31 } from "openapi3-ts";
import { ZodType, z } from "zod";
import { generateSchema } from "./zod-openapi";

export const toSchema = (schema: ZodType): oas31.SchemaObject => {
  const result = generateSchema(schema);
  result.description = schema.description;
  return result;
};

const toCommittedEventSchema = (
  name: string,
  schema: ZodType
): oas31.SchemaObject => {
  const committedEventSchema = toSchema(
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
    (committedEventSchema.properties["data"] = toSchema(schema));
  return committedEventSchema;
};

const messageSchema = z.object({ name: z.string(), data: z.object({}) });
const commandTargetSchema = z.object({
  stream: z.string().optional(),
  expectedVersion: z.number().optional(),
  actor: z
    .object({
      id: z.string(),
      name: z.string(),
      roles: z.array(z.string())
    })
    .optional()
});

const errorSchemas = {
  ValidationError: toSchema(
    z.object({
      name: z.enum([Errors.ValidationError]),
      message: z.string().min(1),
      details: z.object({
        errors: z.array(z.string()),
        message: messageSchema.optional()
      })
    })
  ),
  InvariantError: toSchema(
    z.object({
      name: z.enum([Errors.InvariantError]),
      message: z.string().min(1),
      details: z.object({
        name: z.string(),
        data: z.object({}),
        target: commandTargetSchema,
        description: z.string()
      })
    })
  ),
  RegistrationError: toSchema(
    z.object({
      name: z.enum([Errors.RegistrationError]),
      message: z.string().min(1)
    })
  ),
  ConcurrencyError: toSchema(
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
  ActorConcurrencyError: toSchema(
    z.object({
      name: z.enum([Errors.ActorConcurrencyError]),
      message: z.string().min(1),
      actor: z.string(),
      event: z.object({
        name: z.string(),
        data: z.object({})
      }),
      count: z.number().int(),
      expectedCount: z.number().int()
    })
  )
};

const allStreamSchemas = (
  allStream: boolean
): Record<string, oas31.SchemaObject> =>
  allStream
    ? {
        StoreStats: toSchema(
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
        StoreSubscriptions: toSchema(
          z.array(
            z.object({
              consumer: z.string(),
              watermark: z.number(),
              lease: z.string().optional(),
              expires: z.date().optional()
            })
          )
        ),
        CommittedEvent: toSchema(
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
    : {};

const toProjectionResultsSchema = (ref: string): oas31.SchemaObject => {
  return {
    type: "object",
    properties: {
      upserted: {
        type: "array",
        items: {
          type: "object",
          properties: {
            where: {
              type: "object",
              $ref: `#/components/schemas/${ref}`
            },
            count: { type: "number" }
          }
        }
      },
      deleted: {
        type: "array",
        items: {
          type: "object",
          properties: {
            where: { type: "object", $ref: `#/components/schemas/${ref}` },
            count: { type: "number" }
          }
        }
      },
      watermark: { type: "number" },
      error: { type: "string" }
    }
  };
};

const toProjectionRecordSchema = (ref: string): oas31.SchemaObject => {
  return {
    type: "object",
    properties: {
      state: { type: "object", $ref: `#/components/schemas/${ref}` },
      watermark: { type: "number" }
    }
  };
};

const toSnapshotSchema = (
  name: string,
  events: string[]
): oas31.SchemaObject => {
  return {
    type: "object",
    properties: {
      event: {
        anyOf: events.map((event) => ({
          $ref: `#/components/schemas/${event}`
        }))
      },
      state: { $ref: `#/components/schemas/${name}` },
      applyCount: { type: "number" }
    }
  };
};

const getMessageSchemas = (): Record<string, oas31.SchemaObject> =>
  [...app().messages].reduce((schemas, [name, { schema, type }]) => {
    schemas[name] =
      type === "command" || type === "message"
        ? toSchema(schema)
        : toCommittedEventSchema(name, schema);
    return schemas;
  }, {} as Record<string, oas31.SchemaObject>);

const getReducibleSchemas = (): Record<string, oas31.SchemaObject> =>
  [...app().artifacts.values()]
    .filter((amd) => amd.type === "aggregate")
    .reduce((schemas, { factory, outputs }) => {
      const stateSchema = (factory as ReducibleFactory)("").schemas.state;
      schemas[factory.name] = toSchema(stateSchema);
      schemas[factory.name.concat("Snapshot")] = toSnapshotSchema(
        factory.name,
        outputs
      );
      return schemas;
    }, {} as Record<string, oas31.SchemaObject>);

const getProjectionSchemas = (): Record<string, oas31.SchemaObject> =>
  [...app().artifacts.values()]
    .filter((amd) => amd.type === "projector")
    .reduce((schemas, { factory }) => {
      const stateSchema = (factory as ReducibleFactory)("").schemas.state;
      schemas[factory.name] = toSchema(stateSchema);
      schemas[factory.name.concat("Record")] = toProjectionRecordSchema(
        factory.name
      );
      schemas[factory.name.concat("Results")] = toProjectionResultsSchema(
        factory.name
      );
      return schemas;
    }, {} as Record<string, oas31.SchemaObject>);

export const schemas = (allStream: boolean): oas31.SchemasObject => ({
  ...getMessageSchemas(),
  ...getReducibleSchemas(),
  ...getProjectionSchemas(),
  ...allStreamSchemas(allStream),
  ...errorSchemas
});
