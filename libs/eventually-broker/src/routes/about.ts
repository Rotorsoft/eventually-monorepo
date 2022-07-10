import { config } from "@rotorsoft/eventually";
import { Router } from "express";
import { state } from "../cluster";

export const router = Router();

router.get("/", (_, res) => {
  res.json({ config: config(), state: state().state() });
});
