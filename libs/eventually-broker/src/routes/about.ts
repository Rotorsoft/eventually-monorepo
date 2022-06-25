import { config } from "@rotorsoft/eventually";
import { Router } from "express";

export const router = Router();

router.get("/", (_, res) => {
  res.json(config());
});
