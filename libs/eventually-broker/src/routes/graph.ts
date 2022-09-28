import { Router } from "express";
import { subscriptions } from "..";
import { state } from "../cluster";
import { toSubscriptionsView } from "../models";

export const router = Router();

router.get("/", async (_, res) => {
  const subs = await subscriptions().loadSubscriptions();
  const services = state().services();
  res.render("graph", { services, ...toSubscriptionsView(subs) });
});
