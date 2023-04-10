import { generateSchema } from "./zod-openapi";
import {
  app,
  ArtifactMetadata,
  ArtifactType,
  decamelize,
  ProjectorFactory,
  ReducibleFactory,
  Scope,
  State,
  ZodEmpty
} from "@rotorsoft/eventually";
import { oas31 } from "openapi3-ts";
import z, { ZodObject, ZodType } from "zod";

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

const toPolicyResponseSchema = (commands: string[]): oas31.ResponseObject => {
  const reducibles = commands.reduce((p, c) => {
    const cmd = app().messages.get(c);
    if (cmd && cmd.type === "command")
      cmd.handlers.forEach((h) => {
        const artifact = app().artifacts.get(h);
        artifact && artifact.type === "aggregate" && (p[h] = artifact);
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
    },
    headers: eTag()
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

const toProjectionQueryParameters = (
  factory: ProjectorFactory
): Array<oas31.ParameterObject> => {
  const keys = (factory().schemas.state as unknown as ZodObject<State>).keyof();
  const schema = toSchema(keys);
  return [
    {
      in: "query",
      name: "ids",
      description: "Get these ids",
      schema: { type: "array", items: { type: "string" } }
    },
    {
      in: "query",
      name: "select",
      description: "Selected fields",
      schema: { type: "array", items: schema }
    },
    {
      in: "query",
      name: "where",
      description: "Apply filters using [field op value] syntax",
      schema: { type: "array", items: { type: "string" } }
    },
    {
      in: "query",
      name: "sort",
      description: "Apply sorting using [field asc] or [field desc]",
      schema: { type: "array", items: { type: "string" } }
    },
    {
      in: "query",
      name: "limit",
      description: "Max number of records to return",
      schema: { type: "integer" }
    }
  ];
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

export type Security = {
  schemes: Record<string, oas31.SecuritySchemeObject>;
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
  array = false,
  headers?: oas31.HeadersObject
): oas31.ResponseObject => ({
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
  },
  headers
});

const eTag = (): oas31.HeadersObject => ({
  etag: {
    schema: {
      type: "integer",
      description: "Reducible version number"
    }
  }
});

export const toSchema = (schema: ZodType): oas31.SchemaObject => {
  const result = generateSchema(schema);
  result.description = schema.description;
  return result;
};

export const getMessageSchemas = (): Record<string, oas31.SchemaObject> =>
  [...app().messages].reduce((schemas, [name, { schema, type }]) => {
    schemas[name] =
      type === "command" || type === "message"
        ? toSchema(schema)
        : toCommittedEventSchema(name, schema);
    return schemas;
  }, {} as Record<string, oas31.SchemaObject>);

export const getArtifactTags = (): oas31.TagObject[] =>
  [...app().artifacts.values()].map(({ factory }) => ({
    name: factory.name,
    description: factory("").description
  }));

export const getReducibleSchemas = (): Record<string, oas31.SchemaObject> =>
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

export const getProjectionSchemas = (): Record<string, oas31.SchemaObject> =>
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

export const getPaths = (
  security: Security
): Record<string, oas31.PathItemObject> =>
  [...app().artifacts.values()].reduce(
    (paths, { type, factory, inputs, outputs }) => {
      const endpoints = inputs
        .filter((input) => input.scope === Scope.public)
        .map((input) => input.name);
      if (type === "aggregate") {
        const path = httpGetPath(factory.name).replace("/:id", "/{id}");
        paths[path] = {
          parameters: [{ $ref: "#/components/parameters/id" }],
          get: {
            operationId: `get${factory.name}ById`,
            tags: [factory.name],
            summary: `Gets ${factory.name} by id`,
            responses: {
              "200": toResponse(
                factory.name.concat("Snapshot"),
                "OK",
                false,
                eTag()
              ),
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
      } else if (type === "projector") {
        const path = "/".concat(decamelize(factory.name));
        paths[path] = {
          get: {
            operationId: `query${factory.name}`,
            tags: [factory.name],
            summary: `Query ${factory.name}`,
            parameters: toProjectionQueryParameters(
              factory as ProjectorFactory
            ),
            responses: {
              "200": toResponse(factory.name.concat("Record"), "OK", true),
              default: { description: "Internal Server Error" }
            }
          }
        };
      }
      if (type === "aggregate" || type === "system") {
        endpoints.forEach((message) => {
          const path = httpPostPath(factory.name, type, message);
          paths[path.replace("/:id/", "/{id}/")] = {
            parameters:
              type === "aggregate"
                ? [
                    {
                      $ref: "#/components/parameters/id"
                    },
                    {
                      $ref: "#/components/parameters/expected_version"
                    }
                  ]
                : [],
            post: {
              operationId: message,
              tags: [factory.name],
              summary: `Handles ${message}`,
              description:
                app().messages.get(message)?.schema.description || "",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: { $ref: `#/components/schemas/${message}` }
                  }
                }
              },
              responses: {
                "200":
                  type === "aggregate"
                    ? toResponse(
                        factory.name.concat("Snapshot"),
                        "OK",
                        true,
                        eTag()
                      )
                    : toResponse("", "OK", true),
                "400": toResponse("ValidationError", "Validation Error"),
                "409": toResponse("ConcurrencyError", "Concurrency Error"),
                "500": toResponse("InvariantError", "Invariant Error"),
                default: { description: "Internal Server Error" }
              },
              security: security.operations[message] || [{}]
            }
          };
        });
      } else if (type === "projector") {
        if (endpoints.length) {
          const path = httpPostPath(factory.name, type);
          paths[path] = {
            post: {
              operationId: factory.name,
              tags: [factory.name],
              summary: `Projects ${endpoints.join(",")}`,
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: {
                        anyOf: endpoints.map((message) => ({
                          $ref: `#/components/schemas/${message}`
                        }))
                      }
                    }
                  }
                }
              },
              responses: {
                "200": toResponse(factory.name.concat("Results"), "OK"),
                default: { description: "Internal Server Error" }
              },
              security: security.operations[factory.name] || [{}]
            }
          };
        }
      } else if (endpoints.length) {
        const artifact = factory("");
        const commands =
          "commands" in artifact.schemas ? artifact.schemas.commands : {};
        const path = httpPostPath(factory.name, type);
        paths[path] = {
          post: {
            operationId: factory.name,
            tags: [factory.name],
            summary: `Handles ${endpoints.join(",")}`,
            description: Object.entries(commands)
              .map(([command, schema]) => `"${command}": ${schema.description}`)
              .join("<br/>"),
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    oneOf: endpoints.map((message) => ({
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
    {} as Record<string, oas31.PathItemObject>
  );
