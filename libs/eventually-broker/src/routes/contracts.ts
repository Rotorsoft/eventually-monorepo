import { Router } from "express";
import { subscriptions } from "..";
import { ContractsViewModel } from "../cluster";
import { getServiceContracts } from "../utils";

export const router = Router();

const filterServices = (servicesContracts: Record<string, ContractsViewModel>, filters: {services?:string[], names?: string[]}): Record<string, ContractsViewModel> => {
  if (filters.services) {
    servicesContracts = Object.keys(servicesContracts).reduce((result,  serviceName) => {
      if (filters.services.includes(serviceName))
        result[serviceName] = servicesContracts[serviceName];
      return result;
    }, {} as Record<string, ContractsViewModel>)
  }

  if (filters.names) {
    servicesContracts = Object.keys(servicesContracts).reduce((result,  serviceName) => {
      result[serviceName] = {
        events: servicesContracts[serviceName].events.filter((event: {name:string}) => filters.names.includes(event.name))
      }
      if (!result[serviceName].events.length)
        delete result[serviceName];
      return result;
    }, {} as Record<string, ContractsViewModel>)
  }

  return servicesContracts;
}

router.get("/all", async (req, res) => {
  const servicesDefinitions = await subscriptions().loadServices();
  const servicesContracts = await getServiceContracts(servicesDefinitions);
  const {services, names} = req.query;

  const s = services && (Array.isArray(services) ? services as string[] : [services as string]);
  const n = names && (Array.isArray(names) ? names as string[] : [names as string]);
  
  res.send(filterServices(servicesContracts, {
    services: services && (Array.isArray(services) ? services as string[] : [services as string]),
    names: names && (Array.isArray(names) ? names as string[] : [names as string]),
  }));
})

router.get("/", async (_, res) => {
  const services = await subscriptions().loadServices();
  const servicesContracts = await getServiceContracts(services);
  const events = Object.keys(servicesContracts).reduce((acc, serviceName) => {
    acc = acc.concat(servicesContracts[serviceName].events);
    return acc;
  }, []);
  res.render("contracts-explorer", { events });
});
