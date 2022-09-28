import { Response, Router } from "express";
import { EventContract, getEventContracts } from "../specs";

export const router = Router();

router.get("/events", (_, res: Response<EventContract[]>) => {
  res.send(getEventContracts());
});
