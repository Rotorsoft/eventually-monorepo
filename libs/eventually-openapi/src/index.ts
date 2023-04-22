import { app, config } from "@rotorsoft/eventually";
import { oas31 } from "openapi3-ts";
import { getComponents, getPahts, getSecurity, getTags } from "./utils";

export * from "./config";
export * from "./HttpClient";
export * from "./home";
export * from "./query";
export * from "./specs";
export * from "./types";
export * from "./utils";

const security = getSecurity();

/**
 * Generates OpenAPI 3.1 spec from app metadata
 * @returns the OpenAPI spec
 */
export const openAPI = (): oas31.OpenAPIObject => {
  const { service, version, description, author, license } = config();
  const allStream = app().hasStreams;
  return {
    openapi: "3.1.0",
    info: {
      title: service,
      version: version,
      description: description,
      contact: author,
      license: { name: license }
    },
    servers: [{ url: "/" }],
    tags: getTags(allStream),
    components: getComponents(allStream, security),
    paths: getPahts(allStream, security)
  };
};
