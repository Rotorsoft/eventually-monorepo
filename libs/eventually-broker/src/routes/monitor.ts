import { randomId } from "@andela-technology/eventually";
import { Router } from "express";
import { state } from "../cluster";

export const router = Router();

router.get("/", (req, res) => {
  const session = randomId();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");
  req.on("close", () => state().unsubscribeSSE(session));
  state().subscribeSSE(session, res);
});

router.get("/:id", (req, res) => {
  const session = randomId();
  const id = req.params.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");
  req.on("close", () => {
    state().unsubscribeSSE(session);
  });
  state().subscribeSSE(session, res, id);
});
