import { log } from "@andela-technology/eventually";
import { Router } from "express";
import { subscriptions } from "..";
import { state } from "../cluster";

export const router = Router();

router.get("/toggle/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await subscriptions().toggleSubscription(id);
  } catch (error) {
    log().error(error);
  }
  res.redirect(`/command/wait/${id}`);
});

router.get("/refresh/:id", (req, res) => {
  const id = req.params.id;
  try {
    state().refreshSubscription("MANUAL", id);
  } catch (error) {
    log().error(error);
  }
  res.redirect(`/command/wait/${id}`);
});

router.get("/wait/:id", (req, res) => {
  const id = req.params.id;
  res.render("wait", { id });
});
