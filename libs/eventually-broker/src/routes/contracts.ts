import { Router } from "express";
import { subscriptions } from "..";
import { ContractsViewModel } from "../cluster";
import { getServiceContracts } from "../utils";

export const router = Router();

router.get("/all", async (req, res) => {
  const servicesDefinitions = await subscriptions().loadServices();
  let servicesContracts = await getServiceContracts(servicesDefinitions);
  const {services, names} = req.query;

  if (services) {
    const serviceFilters = Array.isArray(services) ? services : [services];
    servicesContracts = Object.keys(servicesContracts).reduce((result,  serviceName) => {
      if (serviceFilters.includes(serviceName))
      result[serviceName] = servicesContracts[serviceName];
      return result;
    }, {} as Record<string, ContractsViewModel>)
  }

  if (names) {
    const namesFilters = Array.isArray(names) ? names : [names];
    servicesContracts = Object.keys(servicesContracts).reduce((result,  serviceName) => {
      result[serviceName] = {
        events: servicesContracts[serviceName].events.filter((event: {name:string}) => namesFilters.includes(event.name))
      }
      if (!result[serviceName].events.length)
      delete result[serviceName];
      return result;
    }, {} as Record<string, ContractsViewModel>)
  }

  res.send(servicesContracts);
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
