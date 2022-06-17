import { Router } from "express";
import { subscriptions } from "..";
import { getServiceContracts } from "../utils";

export const router = Router();

router.get("/", async (_, res) => {
  const services = await subscriptions().loadServices();
  const rs = await getServiceContracts(services);
  const events = Object.keys(rs.services).reduce((acc, serviceName) => {
    acc = acc.concat(rs.services[serviceName].events);
    return acc;
  }, []);
  res.render("contracts-explorer", { events });
});
