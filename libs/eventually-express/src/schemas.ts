import * as fs from "fs";
import * as joi from "joi";
import j2s, { ComponentsSchema, SwaggerSchema } from "joi-to-swagger";
import {
  CommittedEvent,
  Errors,
  Payload,
  Schema,
  StoreStat
} from "@rotorsoft/eventually";

type Security = {
  schemes: Payload;
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

export const getComponents = (sec: Security): ComponentsSchema => ({
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
    ValidationError: {
      type: "object",
      properties: {
        message: {
          type: "string",
          enum: [Errors.ValidationError]
        },
        details: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["message", "details"]
    },
    RegistrationError: {
      type: "object",
      properties: {
        message: {
          type: "string",
          enum: [Errors.RegistrationError]
        },
        details: { type: "string" }
      }
    },
    ConcurrencyError: {
      type: "object",
      properties: {
        message: {
          type: "string",
          enum: [Errors.ConcurrencyError]
        },
        lastVersion: { type: "integer" },
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              data: { type: "object" }
            },
            required: ["name"]
          }
        },
        expectedVersion: { type: "integer" }
      },
      required: ["message", "lastEvent", "events", "expectedVersion"]
    }
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

export const StoreStatSchema = (): Schema<StoreStat> =>
  joi.object<StoreStat>({
    name: joi.string().required(),
    count: joi.number().integer().required(),
    firstId: joi.number().integer(),
    lastId: joi.number().integer(),
    firstCreated: joi.date(),
    lastCreated: joi.date()
  });

export const toSwaggerSchema = <T extends Payload>(
  schema: Schema<T>,
  existingComponets?: ComponentsSchema
): SwaggerSchema => j2s(schema, existingComponets).swagger;
