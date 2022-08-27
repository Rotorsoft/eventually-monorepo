import { Request, Response, Router } from "express";
import { AllQuery, Service } from "..";
import { ContractsViewModel, state } from "../cluster";
import { ensureArray } from "../utils";

export const router = Router();

const getContracts = (
  services: Service[],
  names?: string[]
): Record<string, ContractsViewModel> => {
  return Object.assign(
    {},
    ...services
      .filter((service) => service.schemas)
      .map((service) => ({
        [service.id]: {
          events: Object.values(service.schemas).filter(
            (schema) => !names || names.includes(schema.name)
          )
        }
      }))
  );
};

router.get(
  "/all",
  (
    req: Request<never, Record<string, ContractsViewModel>, never, AllQuery>,
    res: Response
  ) => {
    const { services, names }: AllQuery = {
      services: req.query.services && ensureArray(req.query.services),
      names: req.query.names && ensureArray(req.query.names)
    };
    const contracts = getContracts(
      state()
        .services()
        .filter((s) => !services || services.includes(s.id)),
      names
    );
    res.send(contracts);
  }
);

router.get("/", (_, res) => {
  const contracts = getContracts(state().services());
  res.render("contracts-explorer", { contracts });
});
