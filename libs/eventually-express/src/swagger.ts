import { committedSchema, config, Handlers } from "@rotorsoft/eventually";
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
        schema: { type: "string" },
        required: true
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
    .map(({ command }) => {
      const { swagger } = j2s(command.schema(), components);
      components.schemas[command.name] = swagger;
    });

  Object.values(handlers.events)
    .filter(({ event }) => event.scope() === "public")
    .map(({ event }) => {
      const { swagger } = j2s(committedSchema(event.schema()), components);
      components.schemas[event.name] = swagger;
    });

  return components;
};

const getPaths = (handlers: Handlers): Record<string, any> => {
  const paths: Record<string, any> = {};

  Object.values(handlers.commands)
    .filter(({ command }) => command.scope() === "public")
    .map(({ command, path }) => {
      paths[path.replace("/:id/", "/{id}/")] = {
        parameters: [{ $ref: "#/components/parameters/id" }],
        post: {
          operationId: command.name,
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
    .map(({ event, path }) => {
      paths[path] = {
        post: {
          operationId: event.name,
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
