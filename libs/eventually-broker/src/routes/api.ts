import { EventContract } from "@rotorsoft/eventually-openapi";
import { Response, Router } from "express";
import { getEventContracts } from "../specs";

export const router = Router();

router.get("/events", (_, res: Response<EventContract[]>) => {
  res.send(getEventContracts());
});
