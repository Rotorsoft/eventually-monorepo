import {
  app,
  Artifact,
  ArtifactMetadata,
  config,
  Reducible,
  reduciblePath
} from "@rotorsoft/eventually";
import {
  OpenAPIObject,
  PathsObject,
  ResponseObject,
  TagObject
} from "openapi3-ts";
import { ZodType } from "zod";
import {
  CommittedEventSchema,
  getComponents,
  getSecurity,
  PolicyResponseSchema,
  SnapshotSchema,
  toOpenAPISchema
} from "./schemas";

const response = (
  schema: string,
  description: string,
  array = false
): ResponseObject => ({
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

export const swagger = (): OpenAPIObject => {
  const getSchemas = (): void => {
    Object.entries(app().messages).map(([name, { schema, type }]) => {
      if (type === "command" || type === "message") {
        components.schemas &&
          (components.schemas[name] = toOpenAPISchema(schema));
      } else if (type === "event") {
        components.schemas &&
          (components.schemas[name] = CommittedEventSchema(name, schema));
      }
    });
  };

  const getReducibleComponent = (
    name: string,
    schema: ZodType,
    events: string[]
  ): void => {
    if (!components.schemas || components.schemas[name]) return;
    components.schemas[name] = toOpenAPISchema(schema);
    components.schemas[name.concat("Snapshot")] = SnapshotSchema(name, events);

    // GET reducible
    const path = reduciblePath(name).replace("/:id", "/{id}");
    if (paths[path]) return;
    paths[path] = {
      parameters: [{ $ref: "#/components/parameters/id" }],
      get: {
        operationId: `get${name}ById`,
        tags: [name],
        summary: `Get ${name} by Id`,
        responses: {
          "200": response(name.concat("Snapshot"), "OK"),
          default: { description: "Internal Server Error" }
        }
      }
    };

    // GET reducible stream
    paths[path.concat("/stream")] = {
      parameters: [{ $ref: "#/components/parameters/id" }],
      get: {
        operationId: `get${name}StreamById`,
        tags: [name],
        summary: `Get ${name} Stream by Id`,
        responses: {
          "200": response(name.concat("Snapshot"), "OK", true),
          default: { description: "Internal Server Error" }
        }
      }
    };
  };

  const getCommandHandlerPath = (
    amd: ArtifactMetadata,
    command: string,
    path: string
  ): void => {
    const schema = components.schemas && components.schemas[command];
    const description =
      (schema && "description" in schema && schema.description) ||
      `Handle **${command}** command`;
    paths[path.replace("/:id/", "/{id}/")] = {
      parameters:
        amd.type === "aggregate"
          ? [{ $ref: "#/components/parameters/id" }]
          : [],
      post: {
        operationId: command,
        tags: [amd.factory.name],
        summary: command,
        description,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${command}` }
            }
          }
        },
        responses: {
          "200": response(
            amd.type === "aggregate" ? amd.factory.name.concat("Snapshot") : "",
            "OK",
            true
          ),
          "400": response("ValidationError", "Validation Error"),
          "409": response("ConcurrencyError", "Concurrency Error"),
          default: { description: "Internal Server Error" }
        },
        security: sec.operations[command] || [{}]
      }
    };
  };

  const getEventHandlerPath = (
    amd: ArtifactMetadata,
    path: string,
    events: string[]
  ): void => {
    if (paths[path]) return;
    paths[path] = {
      post: {
        operationId: amd.factory.name,
        tags: [amd.factory.name],
        summary: `Handle ${amd.factory.name} events`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: events.map((name) => ({
                  $ref: `#/components/schemas/${name}`
                }))
              }
            }
          }
        },
        responses: {
          "200": PolicyResponseSchema(amd.outputs),
          "400": response("ValidationError", "Validation Error"),
          "404": response("RegistrationError", "Registration Error"),
          default: { description: "Internal Server Error" }
        },
        security: sec.operations[amd.factory.name] || [{}]
      }
    };
  };

  const getPaths = (): void => {
    Object.values(app().artifacts).map((amd) => {
      const artifact = amd.factory("") as Artifact;
      "reduce" in artifact &&
        getReducibleComponent(
          amd.factory.name,
          (artifact as Reducible).schemas.state,
          amd.outputs
        );

      tags.push({
        name: amd.factory.name,
        description: artifact.description
      });

      if (amd.type === "aggregate" || amd.type === "system")
        Object.entries(amd.inputs).forEach(([name, path]) =>
          getCommandHandlerPath(amd, name, path)
        );
      else {
        const path = Object.values(amd.inputs).at(0);
        path && getEventHandlerPath(amd, path, Object.keys(amd.inputs));
      }
    });
  };

  const sec = getSecurity();
  const components = getComponents(sec);
  const tags: TagObject[] = [];
  const paths: PathsObject = {};

  getSchemas();
  getPaths();

  if (app().hasStreams) {
    paths["/stats"] = {
      get: {
        tags: ["All Stream"],
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
        tags: ["All Stream"],
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

  const { service, version, description, author, license } = config();
  return {
    openapi: "3.0.3",
    info: {
      title: service,
      version: version,
      description: description,
      contact: author,
      license: { name: license }
    },
    servers: [{ url: "/" }],
    tags,
    components,
    paths
  };
};
