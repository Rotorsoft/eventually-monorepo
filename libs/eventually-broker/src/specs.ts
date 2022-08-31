import { log } from "@rotorsoft/eventually";
import axios from "axios";
import { OpenAPIV3_1 } from "openapi-types";
import {
  ExtendedPathItemObject,
  ExtendedSchemaObject,
  SecretOptions,
  Service,
  ServiceSpec
} from "./types";
import { toQueryString } from "./utils";

const HTTP_TIMEOUT = 5000;

// /**
//  * Loads service endpoints metadata
//  *
//  * @param service The service
//  * @returns The endpoints payload
//  */
// export const getServiceEndpoints = async (
//   service: Service
// ): Promise<Endpoints | undefined> => {
//   try {
//     const url = new URL(service.url);
//     if (!url.protocol.startsWith("http")) return undefined;
//     const { data } = await axios.get<Endpoints>(`${url.origin}/_endpoints`, {
//       timeout: HTTP_TIMEOUT
//     });
//     return data;
//   } catch (err) {
//     log().error(err);
//     return undefined;
//   }
// };

/**
 * Loads service swagger metadata
 *
 * @param service The service
 * @returns The swagger json document spec
 */
const getServiceSwagger = async (
  service: Service,
  queryString: string
): Promise<OpenAPIV3_1.Document | undefined> => {
  try {
    const url = new URL(service.url);
    if (!url.protocol.startsWith("http")) return undefined;
    const path = `${url.origin}/swagger${queryString}`;
    const { data } = await axios.get<OpenAPIV3_1.Document>(path, {
      timeout: HTTP_TIMEOUT
    });
    return data;
  } catch (err) {
    log().error(err);
    return undefined;
  }
};

const getEvent = (
  schema: OpenAPIV3_1.SchemaObject
): ExtendedSchemaObject | undefined =>
  schema?.properties?.name &&
  "enum" in schema?.properties?.name &&
  schema?.properties?.created &&
  schema?.properties?.data &&
  "properties" in schema?.properties?.data
    ? { ...schema, name: schema.properties.name.enum[0] }
    : undefined;

const SCHEMA = "#/components/schemas/";
const getRefs = (object: unknown, refs: string[]): void => {
  if (typeof object === "object") {
    Object.entries(object).forEach(([key, value]) => {
      if (key !== "$ref") getRefs(value, refs);
      else if (typeof value === "string" && value.startsWith(SCHEMA))
        refs.push(value.substring(SCHEMA.length));
    });
  }
};

const getSpec = (document: OpenAPIV3_1.Document): ServiceSpec => {
  const handlers: ExtendedPathItemObject[] = Object.entries(
    document?.paths || {}
  )
    .map(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => {
        if (
          method === "post" &&
          typeof operation === "object" &&
          "requestBody" in operation
        ) {
          const handler: ExtendedPathItemObject = {
            ...operation,
            path,
            refs: [] as string[]
          };
          getRefs(operation.requestBody, handler.refs);
          return handler;
        }
      })
    )
    .flat()
    .filter(Boolean);

  const eventSchemas = Object.assign(
    {},
    ...Object.values(document?.components?.schemas || {})
      .map((schema) => {
        const event = getEvent(schema);
        return event && { ...event, refs: [] };
      })
      .filter(Boolean)
      .map((event) => ({ [event.name]: event }))
  ) as Record<string, ExtendedSchemaObject>;

  const { commandHandlers, eventHandlers } = handlers.reduce(
    (map, handler) => {
      const found = handler.refs.filter((ref) => {
        const schema = eventSchemas[ref];
        schema && schema.refs.push(handler.path);
        return schema;
      });
      found.length
        ? map.eventHandlers.push(handler)
        : map.commandHandlers.push(handler);
      return map;
    },
    {
      commandHandlers: [] as ExtendedPathItemObject[],
      eventHandlers: [] as ExtendedPathItemObject[]
    }
  );

  return {
    discovered: new Date(),
    version: document.info.version,
    commandHandlers: Object.assign(
      {},
      ...commandHandlers.map((handler) => ({ [handler.path]: handler }))
    ),
    eventHandlers: Object.assign(
      {},
      ...eventHandlers.map((handler) => ({ [handler.path]: handler }))
    ),
    schemas: eventSchemas
  };
};

export const refreshServiceSpec = async (
  service: Service,
  secrets?: SecretOptions
): Promise<void> => {
  const queryString =
    (secrets?.byService &&
      toQueryString(
        Object.assign(
          {},
          secrets.byService["all"],
          secrets.byService[service.id]
        )
      )) ||
    "";
  const document = await getServiceSwagger(service, queryString);
  document && document.info && Object.assign(service, getSpec(document));
};
