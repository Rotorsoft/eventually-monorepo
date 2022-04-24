import axios from "axios";
import { Router } from "express";
import { OpenAPIV3_1 } from 'openapi-types';
import { Service, subscriptions } from "..";
import { ContractsViewModel } from "../cluster";

export const router = Router();

const rows = (services: Service[]): Promise<{services: Record<string, ContractsViewModel>}> => {
  return Promise.all(
    services.reduce((acc, service) => {
      if (!service.url.startsWith('http')) return acc;
      acc.push(axios.get<OpenAPIV3_1.Document>(`${service.url}/swagger`)
        .then((response) => response.data)
        .then((apiDef) => apiDef?.components?.schemas)
        .then((schemas) => {
          return Object.keys(schemas).reduce((acc, name) => {
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
                payload: (schemas[name].properties.data as OpenAPIV3_1.SchemaObject).properties,
                service: service.id,
                schemaDescription: schemas[name].description
              })
            else if (name.endsWith('Error')) acc.errors.push({ ...schemas[name], service: service.id })
            else acc.commands.push({ ...schemas[name], service:service.id });
            return acc;
          }, {service, commands: [], events: [], errors: []} )
        }))
      return acc;
    }, [])
  )
    .then((contracts) => {
      return contracts.reduce((acc, contract) => {
        acc.services[contract.service.id] = {
          commands: contract.commands,
          events: contract.events,
          errors: contract.errors,
        };
        return acc;
      }, {services: {}} as {services: Record<string, ContractsViewModel>})
    })
};


router.get("/", async (_, res) => {
  const services = await subscriptions().loadServices();
  const rs = await rows(services);
  const events = Object.keys(rs.services).reduce((acc, serviceName)=> {
    acc = acc.concat(rs.services[serviceName].events)
    return acc;
  }, [])
  res.render("contracts-explorer", {events});
});
