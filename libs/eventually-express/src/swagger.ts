import {
  Builder,
  config,
  Errors,
  eventsOf,
  getReducible,
  MessageHandlerFactory,
  messagesOf,
  Payload,
  Reducible,
  reduciblePath,
  StoreStat
} from "@rotorsoft/eventually";
import * as fs from "fs";
import * as joi from "joi";
import j2s, { ComponentsSchema } from "joi-to-swagger";

type Security = {
  schemes: Record<string, any>;
  operations: Record<string, Array<any>>;
};

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

export const swagger = (app: Builder): any => {
  const getSchemas = (): void => {
    Object.entries(app.messages).map(
      ([name, { schema, commandHandlerFactory }]) => {
        if (commandHandlerFactory) {
          components.schemas[name] = schema
            ? j2s(schema).swagger
            : { type: "object" };
        } else {
          const data = schema || joi.object().forbidden();
          const description =
            data._flags?.description || "No description provided";
          data._flags.description = undefined;
          components.schemas[name] = j2s(
            joi.object({
              name: joi.string().required().valid(name),
              id: joi.number().integer().required(),
              stream: joi.string().required(),
              version: joi.number().integer().required(),
              created: joi.date().required(),
              data
            })
          ).swagger;
          components.schemas[name].description = description;
        }
      }
    );
  };

  const getReducibleGetters = (
    paths: Record<string, any>,
    handler: MessageHandlerFactory<Payload, unknown, unknown>
  ): void => {
    if (!getReducible(handler(null))) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const path = reduciblePath(handler as any).replace("/:id", "/{id}");
    if (paths[path]) return;
    // GET reducible
    paths[path] = {
      parameters: [{ $ref: "#/components/parameters/id" }],
      get: {
        operationId: `get${handler.name}ById`,
        tags: [handler.name],
        summary: `Get ${handler.name} by Id`,
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  $ref: `#/components/schemas/${handler.name}Snapshot`
                }
              }
            }
          },
          default: { description: "Internal Server Error" }
        }
      }
    };
    // GET reducible stream
    paths[path.concat("/stream")] = {
      parameters: [{ $ref: "#/components/parameters/id" }],
      get: {
        operationId: `get${handler.name}StreamById`,
        tags: [handler.name],
        summary: `Get ${handler.name} Stream by Id`,
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: `#/components/schemas/${handler.name}Snapshot`
                  }
                }
              }
            }
          },
          default: { description: "Internal Server Error" }
        }
      }
    };
  };

  const getReducibleComponent = (
    handler: MessageHandlerFactory<Payload, unknown, unknown>
  ): Reducible<Payload, unknown> => {
    const reducible = getReducible(handler(null));
    if (!reducible) return;
    if (components.schemas[handler.name]) return reducible;
    const { swagger } = j2s(reducible.schema(), components);
    components.schemas[handler.name] = swagger;
    components.schemas[handler.name.concat("Snapshot")] = {
      type: "object",
      properties: {
        event: {
          anyOf: eventsOf(reducible).map((name) => ({
            $ref: `#/components/schemas/${name}`
          }))
        },
        state: { $ref: `#/components/schemas/${handler.name}` }
      }
    };
    return reducible;
  };

  const getPaths = (): void => {
    Object.values(app.endpoints.commandHandlers).map(
      ({ factory, commands }) => {
        const reducible = getReducibleComponent(factory);
        getReducibleGetters(paths, factory);
        tags.push({
          name: factory.name,
          description: app.documentation[factory.name].description
        });
        Object.entries(commands).map(([name, path]) => {
          const description =
            components.schemas[name]?.description ||
            `Handles **${name}** Command`;
          delete components.schemas[name]?.description;
          paths[path.replace("/:id/", "/{id}/")] = {
            parameters: reducible
              ? [{ $ref: "#/components/parameters/id" }]
              : [],
            post: {
              operationId: name,
              tags: [factory.name],
              summary: name,
              description,
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: { $ref: `#/components/schemas/${name}` }
                  }
                }
              },
              responses: {
                "200": {
                  description: "OK",
                  content: {
                    "application/json": {
                      schema: {
                        type: "array",
                        items: reducible
                          ? {
                              $ref: `#/components/schemas/${factory.name}Snapshot`
                            }
                          : {}
                      }
                    }
                  }
                },
                "400": {
                  description: "Validation Error",
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/ValidationError" }
                    }
                  }
                },
                "409": {
                  description: "Concurrency Error",
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/ConcurrencyError" }
                    }
                  }
                },
                default: { description: "Internal Server Error" }
              },
              security: sec.operations[name] || [{}]
            }
          };
        });
      }
    );

    Object.values(app.endpoints.eventHandlers).map(({ factory, path }) => {
      getReducibleComponent(factory);
      getReducibleGetters(paths, factory);
      tags.push({
        name: factory.name,
        description: app.documentation[factory.name].description
      });
      paths[path] = {
        post: {
          operationId: factory.name,
          tags: [factory.name],
          summary: `Handle ${factory.name} Events`,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: messagesOf(factory(undefined)).map((name) => ({
                    $ref: `#/components/schemas/${name}`
                  }))
                }
              }
            }
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      response: {
                        type: "object",
                        properties: {
                          command: { type: "object" },
                          id: { type: "string" },
                          expectedVersion: { type: "integer" }
                        }
                      },
                      state: {
                        type: "object"
                      }
                    }
                  }
                }
              }
            },
            "400": {
              description: "Validation Error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ValidationError" }
                }
              }
            },
            "404": {
              description: "Registration Error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RegistrationError" }
                }
              }
            },
            default: { description: "Internal Server Error" }
          },
          security: sec.operations[factory.name] || [{}]
        }
      };
    });
  };

  const sec = getSecurity();
  const components: ComponentsSchema = {
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
  };
  const tags: { name: string; description: string }[] = [];
  const paths: Record<string, any> = {};

  if (app.hasStreams) {
    paths["/stats"] = {
      get: {
        operationId: "getStats",
        summary: "Get Store Stats",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: j2s(
                    joi.object<StoreStat>({
                      name: joi.string().required(),
                      count: joi.number().integer().required(),
                      firstId: joi.number().integer(),
                      lastId: joi.number().integer(),
                      firstCreated: joi.date(),
                      lastCreated: joi.date()
                    })
                  ).swagger
                }
              }
            }
          },
          default: { description: "Internal Server Error" }
        },
        security: sec.operations["stats"] || [{}]
      }
    };

    paths["/all"] = {
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
        operationId: "getAll",
        summary: "Query All Stream",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: j2s(
                    joi.object({
                      name: joi.string().required(),
                      id: joi.number().integer().required(),
                      stream: joi.string().required(),
                      version: joi.number().integer().required(),
                      created: joi.date().required(),
                      data: joi.object()
                    })
                  ).swagger
                }
              }
            }
          },
          default: { description: "Internal Server Error" }
        },
        security: sec.operations["all"] || [{}]
      }
    };
  }
  getSchemas();
  getPaths();

  return {
    openapi: "3.0.3",
    info: {
      title: config().service,
      version: config().version,
      description: config().description
    },
    servers: [{ url: "/" }],
    tags,
    components,
    paths
  };
};
