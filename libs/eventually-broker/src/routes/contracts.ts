import { Router } from "express";
import { getEventContracts } from "../specs";

export const router = Router();

router.get("/", (_, res) => {
  const events = getEventContracts();
  res.render("contracts", { events });
});
