import {
  config,
  eventsOf,
  Factories,
  getReducible,
  Handlers,
  MessageHandlerFactory,
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

const getComponents = (
  factories: Factories,
  handlers: Handlers,
  security: Security
): ComponentsSchema => {
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
    securitySchemes: security.schemes,
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

  // all events are in committed shape
  Object.values(factories.events).map((ef) => {
    const { swagger } = j2s(
      joi.object({
        name: joi.string().required().valid(ef.name),
        id: joi.number().integer().required(),
        stream: joi.string().required(),
        version: joi.number().integer().required(),
        created: joi.date().required()
      })
    );
    if (ef().schema) swagger.properties.data = j2s(ef().schema).swagger;
    components.schemas[ef.name] = swagger;
  });

  // public commands and aggregate models are components
  Object.values(handlers.commands)
    .filter(({ command }) => command().scope === Scopes.public)
    .map(({ factory, command }) => {
      if (command().schema) {
        const { swagger } = j2s(command().schema, components);
        components.schemas[command.name] = swagger;
      } else {
        components.schemas[command.name] = { type: "object" };
      }
      getReducibleComponent(components, factory);
    });

  // process manager models are components
  Object.values(handlers.events).map(({ factory }) => {
    getReducibleComponent(components, factory);
  });

  return components;
};

const getReducibleComponent = (
  components: ComponentsSchema,
  factory: MessageHandlerFactory<Payload, unknown, unknown>
): void => {
  const reducible = getReducible(factory(null));
  if (!reducible) return;
  if (components.schemas[factory.name]) return;

  const { swagger } = j2s(reducible.schema(), components);
  components.schemas[factory.name] = swagger;
  components.schemas[factory.name.concat("Snapshot")] = {
    type: "object",
    properties: {
      event: {
        oneOf: eventsOf(reducible).map((name) => ({
          $ref: `#/components/schemas/${name}`
        }))
      },
      state: { $ref: `#/components/schemas/${factory.name}` }
    }
  };
};

const getReducibleGetters = (
  paths: Record<string, any>,
  factory: MessageHandlerFactory<Payload, unknown, unknown>
): void => {
  if (!getReducible(factory(null))) return;
  const path = reduciblePath(factory as any).replace("/:id", "/{id}");
  if (paths[path]) return;
  // GET reducible
  paths[path] = {
    parameters: [{ $ref: "#/components/parameters/id" }],
    get: {
      tags: [factory.name],
      summary: `Gets ${factory.name} by id`,
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: {
                $ref: `#/components/schemas/${factory.name}Snapshot`
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
      tags: [factory.name],
      summary: `Gets ${factory.name} stream by id`,
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
        default: { description: "Internal Server Error" }
      }
    }
  };
};

const getPaths = (
  handlers: Handlers,
  security: Security
): Record<string, any> => {
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
        security: security.operations["all"] || [{}]
      }
    }
  };

  Object.values(handlers.commands)
    .filter(({ command }) => command().scope === Scopes.public)
    .map(({ factory, command, path }) => {
      getReducibleGetters(paths, factory);
      // POST command
      paths[path.replace("/:id/", "/{id}/")] = {
        parameters: [{ $ref: "#/components/parameters/id" }],
        post: {
          operationId: command.name,
          tags: [factory.name],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${command.name}` }
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
          security: security.operations[command.name] || [{}]
        }
      };
    });

  Object.values(handlers.events)
    .filter(({ event }) => event().scope === Scopes.public)
    .map(({ factory, event, path }) => {
      getReducibleGetters(paths, factory);
      // POST event
      paths[path] = {
        post: {
          operationId: event.name,
          tags: [factory.name],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${event.name}` }
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
          security: security.operations[event.name] || [{}]
        }
      };
    });

  return paths;
};

export const swagger = (factories: Factories, handlers: Handlers): any => {
  const pkg = getPackage();
  const sec = getSecurity();

  return {
    openapi: "3.0.3",
    info: {
      title: pkg.name,
      version: pkg.version
    },
    servers: [{ url: `${config().host}` }],
    components: getComponents(factories, handlers, sec),
    paths: getPaths(handlers, sec)
  };
};
