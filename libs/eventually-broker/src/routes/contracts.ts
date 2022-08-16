import { Router } from "express";
import { subscriptions } from "..";
import { ContractsViewModel } from "../cluster";
import { getServiceContracts } from "../utils";

export const router = Router();

router.get("/all", async (req, res) => {
  const services = await subscriptions().loadServices();
  let servicesContracts = await getServiceContracts(services)

  if (req.query.services) {
    const serviceFilters = Array.isArray(req.query.services) ? req.query.services : [req.query.services];
    servicesContracts = Object.keys(servicesContracts).reduce((result,  serviceName) => {
      if (serviceFilters.includes(serviceName))
      result[serviceName] = servicesContracts[serviceName];
      return result;
    }, {} as Record<string, ContractsViewModel>)
  }

  if (req.query.names) {
    const namesFilters = Array.isArray(req.query.names) ? req.query.names : [req.query.names];
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
