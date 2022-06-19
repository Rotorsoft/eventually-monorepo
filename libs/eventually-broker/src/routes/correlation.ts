import { Router } from "express";
import { subscriptions } from "..";
import { getCorrelation } from "../utils";

export const router = Router();

router.get("/:id", async (req, res) => {
  const correlation_id = req.params.id;
  if (!correlation_id || correlation_id.length != 24)
    throw Error("Invalid correlation id");
  const services = await subscriptions().loadServices();
  const correlation = await getCorrelation(correlation_id, services);
  res.render("correlation-explorer", { correlation_id, correlation });
});
