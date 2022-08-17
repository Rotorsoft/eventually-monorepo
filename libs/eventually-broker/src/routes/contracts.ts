import { Request, Response, Router } from "express";
import { subscriptions, AllQuery } from "..";
import { ContractsViewModel } from "../cluster";
import { getServiceContracts } from "../utils";

export const router = Router();

const filterServices = (servicesContracts: Record<string, ContractsViewModel>, filters: {services?:string[], names?: string[]}): Record<string, ContractsViewModel> => {
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

router.get("/all", async (
    req: Request<any, Record<string, ContractsViewModel>, any, AllQuery> , 
    res: Response
  ) => {
  const servicesDefinitions = await subscriptions().loadServices();
  let {services, names} = req.query;
  services = services && (Array.isArray(services) ? services : [services]);
  names = names && (Array.isArray(names) ? names : [names]);
  const servicesContracts = await getServiceContracts(servicesDefinitions, services);

  res.send(filterServices(servicesContracts, {
    services: services && (Array.isArray(services) ? services : [services]),
    names: names && (Array.isArray(names) ? names : [names]),
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
