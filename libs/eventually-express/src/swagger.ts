import {
  AggregateFactory,
  committedSchema,
  config,
  getReducible,
  Handlers,
  MessageHandlerFactory,
  Payload,
  ProcessManagerFactory,
  reduciblePath
} from "@rotorsoft/eventually";
import * as fs from "fs";
import j2s, { ComponentsSchema } from "joi-to-swagger";

type Package = {
  name: string;
  version: string;
};

const getPackage = (): Package => {
  try {
    const pkg = fs.readFileSync("package.json");
    return JSON.parse(pkg.toString()) as unknown as Package;
  } catch {
    return { name: "unknown", version: "unknown" };
  }
};

const getComponents = (handlers: Handlers): ComponentsSchema => {
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

  Object.values(handlers.commands)
    .filter(({ command }) => command.scope() === "public")
    .map(({ factory, command }) => {
      const { swagger } = j2s(command.schema(), components);
      components.schemas[command.name] = swagger;
      if (getReducible(factory(null))) {
        components.schemas[factory.name] = {
          type: "object",
          properties: {
            event: {
              type: "object"
              // TODO: schema of events
              //   anyOf: [
              //     { $ref: "#/components/schemas/DigitPressed" },
              //     { $ref: "#/components/schemas/DotPressed" },
              //     { $ref: "#/components/schemas/OperatorPressed" },
              //     { $ref: "#/components/schemas/EqualsPressed" }
              //   ]
            },
            state: {
              type: "object"
              // TODO: schema of model
              // $ref: "#/components/schemas/Calculator"
            }
          }
        };
      }
    });

  Object.values(handlers.events)
    .filter(({ event }) => event.scope() === "public")
    .map(({ factory, event }) => {
      const { swagger } = j2s(committedSchema(event.schema()), components);
      components.schemas[event.name] = swagger;
      if (getReducible(factory(null))) {
        components.schemas[factory.name] = {
          type: "object",
          properties: {
            event: {
              type: "object"
              // TODO: schema of events
              //   anyOf: [
              //     { $ref: "#/components/schemas/DigitPressed" },
              //     { $ref: "#/components/schemas/DotPressed" },
              //     { $ref: "#/components/schemas/OperatorPressed" },
              //     { $ref: "#/components/schemas/EqualsPressed" }
              //   ]
            },
            state: {
              type: "object"
              // TODO: schema of model
              // $ref: "#/components/schemas/Calculator"
            }
          }
        };
      }
    });

  return components;
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
                $ref: `#/components/schemas/${factory.name}`
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
                  $ref: `#/components/schemas/${factory.name}`
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
                  items: {
                    type: "object",
                    properties: {
                      event: { type: "object" },
                      state: { type: "object" }
                    }
                  }
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
          summary: "TODO command summary",
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
                      $ref: `#/components/schemas/${factory.name}`
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
          summary: "TODO event summary",
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
                    type: "object"
                    // TODO: schema of event response
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

export const swagger = (handlers: Handlers): any => {
  const pkg = getPackage();

  return {
    openapi: "3.0.3",
    info: {
      title: pkg.name,
      version: pkg.version
    },
    servers: [{ url: `${config().host}:${config().port}` }],
    components: getComponents(handlers),
    paths: getPaths(handlers)
  };
};
