import { Router } from "express";
import { getCorrelation } from "../queries";

export const router = Router();

router.get("/:id", async (req, res) => {
  const correlation_id = req.params.id;
  if (!correlation_id || correlation_id.length != 24)
    throw Error("Invalid correlation id");
  const correlation = await getCorrelation(correlation_id);
  res.render("correlations", { correlation_id, correlation });
});
