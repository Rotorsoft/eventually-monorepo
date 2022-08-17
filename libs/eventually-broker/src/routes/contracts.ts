import { Request, Response, Router } from "express";
import { subscriptions, AllQuery } from "..";
import { ContractsViewModel } from "../cluster";
import { ensureArray, getServiceContracts } from "../utils";

export const router = Router();

const filterNames = (servicesContracts: Record<string, ContractsViewModel>, names?: string[]): Record<string, ContractsViewModel> => {
  if (names) {
    servicesContracts = Object.keys(servicesContracts).reduce((result,  serviceName) => {
      result[serviceName] = {
        events: servicesContracts[serviceName].events.filter((event: {name:string}) => names.includes(event.name))
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
  
  const {services, names} = {
    services: req.query.services && ensureArray(req.query.services), 
    names: req.query.names && ensureArray(req.query.services)
  }
  
  let servicesDefinitions = (await subscriptions().loadServices())
  
  servicesDefinitions = !services ? servicesDefinitions : servicesDefinitions
    .filter((service) => services.includes(service.id));
  
  const servicesContracts = await getServiceContracts(servicesDefinitions);

  res.send(filterNames(servicesContracts, names));
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
