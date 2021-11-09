import {
  config,
  eventsOf,
  getReducible,
  Handlers,
  MessageHandlerFactory,
  Options,
  Payload,
  reduciblePath,
  Scopes
} from "@rotorsoft/eventually";
import * as fs from "fs";
import * as joi from "joi";
import j2s, { ComponentsSchema } from "joi-to-swagger";

type Package = {
  name: string;
  version: string;
};

type Security = {
  schemes: Record<string, any>;
  operations: Record<string, Array<any>>;
};

const getPackage = (): Package => {
  const pkg = fs.readFileSync("package.json");
  return JSON.parse(pkg.toString()) as unknown as Package;
};

const getSecurity = (): Security => {
  try {
    const sec = fs.readFileSync("security.json");
    return JSON.parse(sec.toString()) as Security;
  } catch {
    return { schemes: {}, operations: {} };
  }
};

export const swagger = (
  handlers: Handlers,
  options: Record<string, Options<Payload>>
): any => {
  const pkg = getPackage();
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
      name: {
        in: "query",
        name: "name",
        description: "Filter by event name",
        schema: { type: "string" }
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
      }
    },
    securitySchemes: sec.schemes,
    schemas: {
      ValidationError: {
        type: "object",
        properties: {
          message: {
            type: "string",
            enum: ["Validation Error"]
          },
          details: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["message", "details"]
      },
      ConcurrencyError: {
        type: "object",
        properties: {
          message: {
            type: "string",
            enum: ["Concurrency Error"]
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

  const getReducibleGetters = (
    paths: Record<string, any>,
    handler: MessageHandlerFactory<Payload, unknown, unknown>
  ): void => {
    if (!getReducible(handler(null))) return;
    const path = reduciblePath(handler as any).replace("/:id", "/{id}");
    if (paths[path]) return;
    // GET reducible
    paths[path] = {
      parameters: [{ $ref: "#/components/parameters/id" }],
      get: {
        tags: [handler.name],
        summary: `Gets ${handler.name} by id`,
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
        tags: [handler.name],
        summary: `Gets ${handler.name} stream by id`,
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
  ): void => {
    const reducible = getReducible(handler(null));
    if (!reducible) return;
    if (components.schemas[handler.name]) return;
    const events = eventsOf(reducible);

    // all events are in committed shape
    events.map((name) => {
      const { swagger } = j2s(
        joi.object({
          name: joi.string().required().valid(name),
          id: joi.number().integer().required(),
          stream: joi.string().required(),
          version: joi.number().integer().required(),
          created: joi.date().required()
        })
      );
      options[name].schema &&
        (swagger.properties.data = j2s(options[name].schema).swagger);
      components.schemas[name] = swagger;
    });

    // model schema
    const { swagger } = j2s(reducible.schema(), components);
    components.schemas[handler.name] = swagger;
    components.schemas[handler.name.concat("Snapshot")] = {
      type: "object",
      properties: {
        event: {
          oneOf: events.map((name) => ({
            $ref: `#/components/schemas/${name}`
          }))
        },
        state: { $ref: `#/components/schemas/${handler.name}` }
      }
    };
  };

  const getComponents = (): ComponentsSchema => {
    // public commands and aggregate models are components
    Object.values(handlers.commands)
      .filter(({ name }) => options[name].scope === Scopes.public)
      .map(({ factory, name }) => {
        if (options[name].schema) {
          const { swagger } = j2s(options[name].schema, components);
          components.schemas[name] = swagger;
        } else {
          components.schemas[name] = { type: "object" };
        }
        getReducibleComponent(factory);
      });

    // process manager models are components
    Object.values(handlers.events).map(({ factory }) => {
      getReducibleComponent(factory);
    });

    return components;
  };

  const getPaths = (): Record<string, any> => {
    const paths: Record<string, any> = {
      ["/all"]: {
        parameters: [
          { $ref: "#/components/parameters/stream" },
          { $ref: "#/components/parameters/name" },
          { $ref: "#/components/parameters/after" },
          { $ref: "#/components/parameters/limit" }
        ],
        get: {
          summary: "Gets ALL stream",
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
      }
    };

    Object.values(handlers.commands)
      .filter(({ path }) => path)
      .map(({ factory, name, path }) => {
        getReducibleGetters(paths, factory);
        // POST command
        paths[path.replace("/:id/", "/{id}/")] = {
          parameters: [{ $ref: "#/components/parameters/id" }],
          post: {
            operationId: name,
            tags: [factory.name],
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
                      items: {
                        $ref: `#/components/schemas/${factory.name}Snapshot`
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

    Object.values(handlers.events)
      .filter(({ path }) => path)
      .map(({ factory, name, path }) => {
        getReducibleGetters(paths, factory);
        // POST event
        paths[path] = {
          post: {
            operationId: name,
            tags: [factory.name],
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

    return paths;
  };

  return {
    openapi: "3.0.3",
    info: {
      title: pkg.name,
      version: pkg.version
    },
    servers: [{ url: `${config().host}` }],
    components: getComponents(),
    paths: getPaths()
  };
};
