import { Actor, Endpoints } from "@rotorsoft/eventually";
import axios from "axios";
import { Request } from "express";
import { OpenAPIV3_1 } from "openapi-types";
import { ContractsViewModel } from "./cluster";
import { Service } from "./types";

/**
 * Validates admin user
 *
 * @param req Request payload
 * @returns boolean when is an Admin
 */
export const isAdmin = (req: Request): boolean | undefined => {
  const { user } = req as Request & { user: Actor };
  return user && user?.roles?.includes("admin");
};

export const getServiceEndpoints = async (
  url: URL
): Promise<Endpoints | undefined> => {
  if (!url.protocol.startsWith("http")) return undefined;
  try {
    const { data } = await axios.get<Endpoints>(`${url.origin}/_endpoints`);
    return data;
  } catch {
    return undefined;
  }
};

export const getServiceContracts = (
  services: Service[]
): Promise<{ services: Record<string, ContractsViewModel> }> => {
  return Promise.all(
    services.reduce((acc, service) => {
      if (!service.url.startsWith("http")) return acc;
      const contractsPromise = axios
        .get<OpenAPIV3_1.Document>(`${service.url}/swagger`)
        .then((response) => response.data)
        .then((apiDef) => apiDef?.components?.schemas)
        .then((schemas: Record<string, any>) => {
          return Object.keys(schemas).reduce(
            (acc, name) => {
              if (
                schemas[name].properties.name &&
                schemas[name].properties.id &&
                schemas[name].properties.stream &&
                schemas[name].properties.version &&
                schemas[name].properties.created &&
                schemas[name].properties.data
              )
                acc.events.push({
                  name,
                  payload: (
                    schemas[name].properties.data as OpenAPIV3_1.SchemaObject
                  ).properties,
                  service: service.id,
                  schemaDescription: schemas[name].description
                });
              else if (name.endsWith("Error"))
                acc.errors.push({ ...schemas[name], service: service.id });
              else acc.commands.push({ ...schemas[name], service: service.id });
              return acc;
            },
            { service, commands: [], events: [], errors: [] }
          );
        })
        .catch(() => undefined);
      acc.push(contractsPromise);
      return acc;
    }, [] as any[])
  ).then((contracts) => {
    return contracts
      .filter((c) => !!c)
      .reduce(
        (acc, contract) => {
          acc.services[contract.service.id] = {
            commands: contract.commands,
            events: contract.events,
            errors: contract.errors
          };
          return acc;
        },
        { services: {} } as { services: Record<string, ContractsViewModel> }
      );
  });
};
