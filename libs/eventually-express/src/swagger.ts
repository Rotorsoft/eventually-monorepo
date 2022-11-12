import {
  Builder,
  config,
  eventsOf,
  getReducible,
  MessageHandlerFactory,
  messagesOf,
  Payload,
  Reducible,
  reduciblePath
} from "@rotorsoft/eventually";
import { OpenAPIV3_1 } from "openapi-types";
import {
  CommittedEventSchema,
  getComponents,
  getSecurity,
  StoreStatSchema,
  toSwaggerSchema
} from "./schemas";

export const swagger = (app: Builder): OpenAPIV3_1.Document => {
  const getSchemas = (): void => {
    Object.entries(app.messages)
      .filter(([name]) => name != "state")
      .map(([name, { schema, commandHandlerFactory }]) => {
        if (commandHandlerFactory) {
          components.schemas[name] = schema
            ? toSwaggerSchema(schema)
            : { type: "object" };
        } else {
          const description = schema?._flags?.description;
          description && (schema._flags.description = undefined);
          components.schemas[name] = toSwaggerSchema(
            CommittedEventSchema(name, schema)
          );
          components.schemas[name].name = name;
          components.schemas[name].description = description;
        }
      });
  };

  const getReducibleGetters = (
    paths: Record<string, any>,
    handler: MessageHandlerFactory<Payload, any, any>
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
    handler: MessageHandlerFactory<Payload, any, any>
  ): Reducible<Payload, any> => {
    const reducible = getReducible(handler(null));
    if (!reducible) return;
    if (components.schemas[handler.name]) return reducible;
    const schema =
      reducible.schemas?.state || (reducible.schema && reducible.schema());
    if (schema) {
      components.schemas[handler.name] = toSwaggerSchema(schema, components);
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
    }
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
  const components = getComponents(sec);
  const tags: { name: string; description: string }[] = [];
  const paths: Record<string, OpenAPIV3_1.PathItemObject> = {};

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
                  items: toSwaggerSchema(StoreStatSchema())
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
                  items: toSwaggerSchema(CommittedEventSchema(""))
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
