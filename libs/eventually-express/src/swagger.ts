import {
  AggregateFactory,
  committedSchema,
  config,
  eventsOf,
  Factories,
  getReducible,
  Handlers,
  handlersOf,
  MessageHandlerFactory,
  Payload,
  ProcessManagerFactory,
  reduciblePath
} from "@rotorsoft/eventually";
import * as fs from "fs";
import * as joi from "joi";
import j2s, { ComponentsSchema } from "joi-to-swagger";

type Package = {
  name: string;
  version: string;
};

const getPackage = (): Package => {
  const pkg = fs.readFileSync("package.json");
  return JSON.parse(pkg.toString()) as unknown as Package;
};

const getComponents = (
  factories: Factories,
  handlers: Handlers
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
    securitySchemes: {
      auth0_jwt: {
        flows: {
          implicit: {
            authorizationUrl: "https://{OAS_AUTH0_AUTHORIZATION_URL}/authorize",
            scopes: {
              role: "role"
            }
          }
        },
        type: "oauth2",
        "x-google-audiences": "https://{OAS_AUTH0_AUDIENCE}",
        "x-google-issuer": "https://{OAS_AUTH0_AUTHORIZATION_URL}",
        "x-google-jwks_uri":
          "https://{OAS_AUTH0_AUTHORIZATION_URL}/.well-known/jwks.json"
      }
    },
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
        }
      }
    }
  };

  // all events are components of snapshots
  handlersOf(factories.events).map((ef) => {
    const event = ef();
    const { swagger } = j2s(committedSchema(event.schema()), components);
    components.schemas[event.name] = swagger;
  });

  // public commands and aggregate models are components
  Object.values(handlers.commands)
    .filter(({ command }) => command.scope() === "public")
    .map(({ factory, command }) => {
      const { swagger } = j2s(command.schema(), components);
      components.schemas[command.name] = swagger;
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
        type: "object",
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
  const path = reduciblePath(
    factory as
      | AggregateFactory<Payload, unknown, unknown>
      | ProcessManagerFactory<Payload, unknown, unknown>
  ).replace("/:id", "/{id}");
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

const getPaths = (handlers: Handlers): Record<string, any> => {
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
                    committedSchema(
                      joi.object({
                        name: joi.string().required(),
                        data: joi.object()
                      })
                    )
                  ).swagger
                }
              }
            }
          },
          default: { description: "Internal Server Error" }
        }
      }
    }
  };

  Object.values(handlers.commands)
    .filter(({ command }) => command.scope() === "public")
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
              description: "Concurrency Error"
            },
            default: { description: "Internal Server Error" }
          }
        }
      };
    });

  Object.values(handlers.events)
    .filter(({ event }) => event.scope() === "public")
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
              description: "Concurrency Error"
            },
            default: { description: "Internal Server Error" }
          }
        }
      };
    });

  return paths;
};

export const swagger = (factories: Factories, handlers: Handlers): any => {
  const pkg = getPackage();

  return {
    openapi: "3.0.3",
    info: {
      title: pkg.name,
      version: pkg.version
    },
    servers: [{ url: `${config().host}:${config().port}` }],
    components: getComponents(factories, handlers),
    paths: getPaths(handlers)
  };
};
