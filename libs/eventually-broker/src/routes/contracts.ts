import { Request, Response, Router } from "express";
import { AllQuery } from "..";
import { state } from "../cluster";
import {
  EventContract,
  getEventContracts,
  getServiceContracts,
  ServiceContracts
} from "../specs";
import { ensureArray } from "../utils";

export const router = Router();

router.get(
  "/all",
  (
    req: Request<never, Record<string, ServiceContracts>, never, AllQuery>,
    res: Response<Record<string, ServiceContracts>>
  ) => {
    const { services, names }: AllQuery = {
      services: req.query.services && ensureArray(req.query.services),
      names: req.query.names && ensureArray(req.query.names)
    };
    const contracts = getServiceContracts(
      state()
        .services()
        .filter((s) => !services || services.includes(s.id)),
      names
    );
    res.send(contracts);
  }
);

router.get("/events", (req: Request, res: Response<EventContract[]>) => {
  res.send(getEventContracts());
});

router.get("/", (_, res) => {
  const events = getEventContracts();
  res.render("contracts-explorer", { events });
});
