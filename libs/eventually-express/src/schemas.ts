import { generateSchema } from "@anatine/zod-openapi";
import {
  CommittedEvent,
  Errors,
  Payload,
  Schema,
  StoreStat
} from "@rotorsoft/eventually";
import * as fs from "fs";
import * as joi from "joi";
import j2s from "joi-to-swagger";
import { OpenAPIV3_1 } from "openapi-types";

type Security = {
  schemes: Record<string, OpenAPIV3_1.SecuritySchemeObject>;
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

export const getComponents = (sec: Security): OpenAPIV3_1.ComponentsObject => ({
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
    ValidationError: j2s(
      joi.object({
        message: joi.string().required().valid(Errors.ValidationError),
        details: joi.array().items(joi.string()).required()
      })
    ).swagger,
    RegistrationError: j2s(
      joi.object({
        message: joi.string().required().valid(Errors.RegistrationError),
        details: joi.string().required()
      })
    ).swagger,
    ConcurrencyError: j2s(
      joi.object({
        message: joi.string().required().valid(Errors.ConcurrencyError),
        lastVersion: joi.number().integer().required(),
        events: joi
          .array()
          .items(
            joi.object({
              name: joi.string().required(),
              data: joi.object({})
            })
          )
          .required(),
        expectedVersion: joi.number().integer().required()
      })
    ).swagger,
    StoreStats: j2s(
      joi
        .array()
        .items(
          joi.object<StoreStat>({
            name: joi.string().required(),
            count: joi.number().integer().required(),
            firstId: joi.number().integer().required(),
            lastId: joi.number().integer().required(),
            firstCreated: joi.date().required(),
            lastCreated: joi.date().required()
          })
        )
        .required()
    ).swagger,
    CommittedEvent: j2s(
      joi.object({
        name: joi.string().required(),
        id: joi.number().integer().required(),
        stream: joi.string().required(),
        version: joi.number().integer().required(),
        created: joi.date().required(),
        data: joi.object().optional()
      })
    ).swagger,
    PolicyResponse: j2s(
      joi.object({
        command: joi
          .object({
            name: joi.string().required(),
            data: joi.object().optional(),
            id: joi.string().optional(),
            expectedVersion: joi.number().integer().optional(),
            actor: joi
              .object({
                name: joi.string().required(),
                roles: joi.array().required().items(joi.string())
              })
              .optional()
          })
          .optional(),
        state: joi.object().optional()
      })
    ).swagger
  }
});

export const CommittedEventSchema = <T extends Payload>(
  name: string,
  schema?: Schema<T>
): Schema<CommittedEvent> =>
  joi.object({
    name: joi.string().required().valid(name),
    id: joi.number().integer().required(),
    stream: joi.string().required(),
    version: joi.number().integer().required(),
    created: joi.date().required(),
    data: schema || joi.object().forbidden()
  });

/**
 * Converts generic schemas (`joi`, `zod`) into OpenAPI Spec 3.1 SchemaObject
 *
 * @param schema the generic schema
 * @param existingComponets optional existing swagger components
 * @returns OpenAPI Schema Object
 */
export const toOpenAPISchema = <T extends Payload>(
  schema: Schema<T>,
  existingComponets?: OpenAPIV3_1.ComponentsObject
): OpenAPIV3_1.SchemaObject => {
  if ("validate" in schema) {
    const description = schema?._flags?.description;
    description && (schema._flags.description = undefined);
    const { swagger } = j2s(schema, existingComponets);
    swagger.description = description;
    return swagger;
  } else {
    const result = generateSchema(schema) as OpenAPIV3_1.SchemaObject;
    result.description = schema.description;
    return result;
  }
};
