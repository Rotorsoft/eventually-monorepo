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
  toOpenAPISchema
} from "./schemas";

const response = (
  schema: string,
  description: string,
  array = false
): OpenAPIV3_1.ResponseObject => ({
  description,
  content: {
    "application/json": {
      schema: array
        ? {
            type: "array",
            items: schema
              ? {
                  $ref: `#/components/schemas/${schema}`
                }
              : {}
          }
        : schema
        ? {
            $ref: `#/components/schemas/${schema}`
          }
        : {}
    }
  }
});

export const swagger = (app: Builder): OpenAPIV3_1.Document => {
  const getSchemas = (): void => {
    Object.entries(app.messages)
      .filter(([name]) => name != "state")
      .map(([name, { schema, commandHandlerFactory }]) => {
        if (commandHandlerFactory) {
          components.schemas[name] = schema
            ? toOpenAPISchema(schema)
            : { type: "object" };
        } else {
          components.schemas[name] = toOpenAPISchema(
            CommittedEventSchema(name, schema)
          );
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
          "200": response(handler.name.concat("Snapshot"), "OK"),
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
          "200": response(handler.name.concat("Snapshot"), "OK", true),
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
      components.schemas[handler.name] = toOpenAPISchema(schema, components);
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
                "200": response(
                  reducible ? factory.name.concat("Snapshot") : "",
                  "OK",
                  true
                ),
                "400": response("ValidationError", "Validation Error"),
                "409": response("ConcurrencyError", "Concurrency Error"),
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
            "200": response("PolicyResponse", "OK"),
            "400": response("ValidationError", "Validation Error"),
            "404": response("RegistrationError", "Registration Error"),
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
          "200": response("StoreStats", "OK"),
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
          "200": response("CommittedEvent", "OK", true),
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
