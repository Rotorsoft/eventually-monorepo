import { generateSchema } from "@anatine/zod-openapi";
import {
  app,
  ArtifactMetadata,
  ArtifactType,
  decamelize,
  ReducibleFactory,
  ZodEmpty
} from "@rotorsoft/eventually";
import {
  PathsObject,
  ResponseObject,
  SchemaObject,
  SecuritySchemeObject,
  TagObject
} from "openapi3-ts";
import z, { ZodType } from "zod";

const toSnapshotSchema = (name: string, events: string[]): SchemaObject => {
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

const toPolicyResponseSchema = (commands: string[]): ResponseObject => {
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

const toCommittedEventSchema = (
  name: string,
  schema: ZodType
): SchemaObject => {
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

export type Security = {
  schemes: Record<string, SecuritySchemeObject>;
  operations: Record<string, Array<any>>;
};

export const httpGetPath = (name: string): string =>
  "/".concat(decamelize(name), "/:id");

export const httpPostPath = (
  name: string,
  type: ArtifactType,
  message = ""
): string => {
  switch (type) {
    case "aggregate":
      return "/".concat(decamelize(name), "/:id/", decamelize(message));
    case "system":
      return "/".concat(decamelize(name), "/", decamelize(message));
    default:
      return "/".concat(decamelize(name));
  }
};

export const toResponse = (
  ref: string,
  description: string,
  array = false
): ResponseObject => ({
  description,
  content: {
    "application/json": {
      schema: array
        ? {
            type: "array",
            items: ref
              ? {
                  $ref: `#/components/schemas/${ref}`
                }
              : {}
          }
        : ref
        ? {
            $ref: `#/components/schemas/${ref}`
          }
        : {}
    }
  }
});

export const toSchema = (schema: ZodType): SchemaObject => {
  const result = generateSchema(schema);
  result.description = schema.description;
  return result;
};

export const getMessageSchemas = (): Record<string, SchemaObject> =>
  Object.entries(app().messages).reduce((schemas, [name, { schema, type }]) => {
    schemas[name] =
      type === "command" || type === "message"
        ? toSchema(schema)
        : toCommittedEventSchema(name, schema);
    return schemas;
  }, {} as Record<string, SchemaObject>);

export const getArtifactTags = (): TagObject[] =>
  Object.values(app().artifacts).map(({ factory }) => ({
    name: factory.name,
    description: factory("").description
  }));

export const getReducibleSchemas = (): Record<string, SchemaObject> =>
  Object.values(app().artifacts)
    .filter((amd) => amd.type === "aggregate" || amd.type === "process-manager")
    .reduce((schemas, { factory, outputs }) => {
      const stateSchema = (factory as ReducibleFactory)("").schemas.state;
      schemas[factory.name] = toSchema(stateSchema);
      schemas[factory.name.concat("Snapshot")] = toSnapshotSchema(
        factory.name,
        outputs
      );
      return schemas;
    }, {} as Record<string, SchemaObject>);

export const getPaths = (security: Security): Record<string, PathsObject> =>
  Object.values(app().artifacts).reduce(
    (paths, { type, factory, inputs, outputs }) => {
      if (type === "aggregate" || type === "process-manager") {
        const path = httpGetPath(factory.name).replace("/:id", "/{id}");
        paths[path] = {
          parameters: [{ $ref: "#/components/parameters/id" }],
          get: {
            operationId: `get${factory.name}ById`,
            tags: [factory.name],
            summary: `Gets ${factory.name} by id`,
            responses: {
              "200": toResponse(factory.name.concat("Snapshot"), "OK"),
              default: { description: "Internal Server Error" }
            }
          }
        };
        paths[path.concat("/stream")] = {
          parameters: [{ $ref: "#/components/parameters/id" }],
          get: {
            operationId: `get${factory.name}StreamById`,
            tags: [factory.name],
            summary: `Gets ${factory.name} stream by id`,
            responses: {
              "200": toResponse(factory.name.concat("Snapshot"), "OK", true),
              default: { description: "Internal Server Error" }
            }
          }
        };
      }
      if (type === "aggregate" || type === "system") {
        inputs.forEach((message) => {
          const path = httpPostPath(factory.name, type, message);
          paths[path.replace("/:id/", "/{id}/")] = {
            parameters:
              type === "aggregate"
                ? [{ $ref: "#/components/parameters/id" }]
                : [],
            post: {
              operationId: message,
              tags: [factory.name],
              summary: `Handles ${message}`,
              description: app().messages[message].schema.description || "",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: { $ref: `#/components/schemas/${message}` }
                  }
                }
              },
              responses: {
                "200": toResponse(
                  type === "aggregate" ? factory.name.concat("Snapshot") : "",
                  "OK",
                  true
                ),
                "400": toResponse("ValidationError", "Validation Error"),
                "409": toResponse("ConcurrencyError", "Concurrency Error"),
                default: { description: "Internal Server Error" }
              },
              security: security.operations[message] || [{}]
            }
          };
        });
      } else {
        const path = httpPostPath(factory.name, type);
        paths[path] = {
          post: {
            operationId: factory.name,
            tags: [factory.name],
            summary: `Handles ${inputs.join(",")}`,
            description: Object.entries(factory("").schemas.commands)
              .map(([command, description]) => `"${command}": ${description}`)
              .join("<br/>"),
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    oneOf: inputs.map((message) => ({
                      $ref: `#/components/schemas/${message}`
                    }))
                  }
                }
              }
            },
            responses: {
              "200": toPolicyResponseSchema(outputs),
              "400": toResponse("ValidationError", "Validation Error"),
              "404": toResponse("RegistrationError", "Registration Error"),
              default: { description: "Internal Server Error" }
            },
            security: security.operations[factory.name] || [{}]
          }
        };
      }
      return paths;
    },
    {} as Record<string, PathsObject>
  );
