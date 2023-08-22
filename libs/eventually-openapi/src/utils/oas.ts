import {
  app,
  ArtifactMetadata,
  decamelize,
  ProjectorFactory,
  State
} from "@rotorsoft/eventually";
import * as fs from "fs";
import { oas31 } from "openapi3-ts";
import { ZodObject } from "zod";
import { schemas, toSchema } from "./schemas";
import { httpGetPath, httpPostPath } from "./utils";

type Security = {
  schemes: Record<string, oas31.SecuritySchemeObject>;
  operations: Record<string, Array<any>>;
};

const eTag = (): oas31.HeadersObject => ({
  etag: {
    schema: {
      type: "integer",
      description: "Reducible version number"
    }
  }
});

const toPolicyResponseSchema = (commands: string[]): oas31.ResponseObject => {
  const reducibles = commands.reduce(
    (p, c) => {
      const cmd = app().messages.get(c);
      if (cmd && cmd.type === "command")
        cmd.handlers.forEach((h) => {
          const artifact = app().artifacts.get(h);
          artifact && artifact.type === "aggregate" && (p[h] = artifact);
        });
      return p;
    },
    {} as Record<string, ArtifactMetadata>
  );
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

const toResponse = (
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

const allStreamTags = (allStream: boolean): oas31.TagObject[] =>
  allStream
    ? [
        {
          name: "All Stream",
          description: "Stream of all events produced by this service"
        }
      ]
    : [];

const getArtifactTags = (): oas31.TagObject[] =>
  [...app().artifacts.values()].map(({ factory }) => ({
    name: factory.name,
    description: factory("").description
  }));

const allStreamParameters: Record<string, oas31.ParameterObject> = {
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
  },
  actor: {
    in: "query",
    name: "actor",
    description: "Filter by actor name",
    schema: { type: "string" }
  }
};

const allStreamPaths = (
  allStream: boolean,
  security: Security
): Record<string, oas31.PathItemObject> =>
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
            { $ref: "#/components/parameters/created_before" },
            { $ref: "#/components/parameters/actor" }
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

const getArtifactPaths = (
  security: Security
): Record<string, oas31.PathItemObject> =>
  [...app().artifacts.values()].reduce(
    (paths, { type, factory, inputs, outputs }) => {
      const endpoints = inputs
        .filter((input) => input.scope === "public")
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
                app().messages.get(message)?.schema.description ||
                "Missing description",
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
                        false,
                        eTag()
                      )
                    : toResponse("", "OK"),
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
              .map(
                ([command, schema]) =>
                  `"${command}": ${schema.description || "Missing description"}`
              )
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
            responses: Object.assign(
              {
                "200": toPolicyResponseSchema(outputs),
                "400": toResponse("ValidationError", "Validation Error"),
                "404": toResponse("RegistrationError", "Registration Error"),
                default: { description: "Internal Server Error" }
              },
              type === "process-manager"
                ? {
                    "409": toResponse(
                      "ActorConcurrencyError",
                      "Actor Concurrency Error"
                    )
                  }
                : {}
            ),
            security: security.operations[factory.name] || [{}]
          }
        };
      }
      return paths;
    },
    {} as Record<string, oas31.PathItemObject>
  );

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

export const getPahts = (
  allStream: boolean,
  security: Security
): oas31.PathsObject => ({
  ...getArtifactPaths(security),
  ...allStreamPaths(allStream, security)
});

export const getTags = (allStream: boolean): oas31.TagObject[] => [
  ...getArtifactTags(),
  ...allStreamTags(allStream)
];

export const getComponents = (
  allStream: boolean,
  security: Security
): oas31.ComponentsObject => ({
  parameters: allStream ? allStreamParameters : {},
  securitySchemes: security.schemes,
  schemas: schemas(allStream)
});
