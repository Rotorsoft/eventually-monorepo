import { app, config, Errors } from "@rotorsoft/eventually";
import * as fs from "fs";
import {
  OpenAPIObject,
  ParameterObject,
  PathItemObject,
  SchemaObject,
  TagObject
} from "openapi3-ts";
import z from "zod";
import {
  getArtifactTags,
  getMessageSchemas,
  getPaths,
  getProjectionSchemas,
  getReducibleSchemas,
  Security,
  toResponse,
  toSchema
} from "./utils";

const getSecurity = (): Security => {
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
const security = getSecurity();

const messageSchema = z.object({ name: z.string(), data: z.object({}) });

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
      details: z.object({ command: messageSchema, description: z.string() })
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
  )
};

const allStreamSchemas = (allStream: boolean): Record<string, SchemaObject> =>
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

const allStreamParameters: Record<string, ParameterObject> = {
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
  },
  expected_version: {
    in: "header",
    name: "if-match",
    description: "Reducible expected version",
    schema: { type: "number" },
    required: false
  }
};

const allStreamPaths = (allStream: boolean): Record<string, PathItemObject> =>
  allStream
    ? {
        ["/_stats"]: {
          get: {
            tags: ["All Stream"],
            operationId: "getStats",
            summary: "Gets store stats",
            responses: {
              "200": toResponse("StoreStats", "OK"),
              default: { description: "Internal Server Error" }
            },
            security: security.operations["_stats"] || [{}]
          }
        },
        ["/_subscriptions"]: {
          get: {
            tags: ["All Stream"],
            operationId: "getSubscriptions",
            summary: "Gets internal consumer subscriptions to the all stream",
            responses: {
              "200": toResponse("StoreSubscriptions", "OK"),
              default: { description: "Internal Server Error" }
            },
            security: security.operations["_subscriptions"] || [{}]
          }
        },
        ["/all"]: {
          parameters: [
            { $ref: "#/components/parameters/stream" },
            { $ref: "#/components/parameters/names" },
            { $ref: "#/components/parameters/after" },
            { $ref: "#/components/parameters/limit" },
            { $ref: "#/components/parameters/before" },
            { $ref: "#/components/parameters/created_after" },
            { $ref: "#/components/parameters/created_before" }
          ],
          get: {
            tags: ["All Stream"],
            operationId: "getAll",
            summary: "Queries all stream",
            responses: {
              "200": toResponse("CommittedEvent", "OK", true),
              default: { description: "Internal Server Error" }
            },
            security: security.operations["all"] || [{}]
          }
        }
      }
    : {};

const allStreamTags = (allStream: boolean): TagObject[] =>
  allStream
    ? [
        {
          name: "All Stream",
          description: "Stream of all events produced by this service"
        }
      ]
    : [];

export const openAPI = (): OpenAPIObject => {
  const { service, version, description, author, license } = config();
  const allStream = app().hasStreams;
  return {
    openapi: "3.0.3",
    info: {
      title: service,
      version: version,
      description: description,
      contact: author,
      license: { name: license }
    },
    servers: [{ url: "/" }],
    tags: [...getArtifactTags(), ...allStreamTags(allStream)],
    components: {
      parameters: allStream ? allStreamParameters : {},
      securitySchemes: security.schemes,
      schemas: {
        ...getMessageSchemas(),
        ...getReducibleSchemas(),
        ...getProjectionSchemas(),
        ...allStreamSchemas(allStream),
        ...errorSchemas
      }
    },
    paths: { ...getPaths(security), ...allStreamPaths(allStream) }
  };
};
