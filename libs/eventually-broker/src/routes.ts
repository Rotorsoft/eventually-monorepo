import { log } from "@rotorsoft/eventually";
import { Router } from "express";
import joi from "joi";
import { Props, Subscription, subscriptions } from ".";
import { state } from "./state";
import { props } from "./utils";

const prepare = (subs: Subscription[]): Array<Subscription & Props> =>
  subs
    .map((sub) => ({ ...sub, ...props(sub) }))
    .sort((a, b) => a.exitStatus.length - b.exitStatus.length);

const defaultSub = {
  channel: "pg://table_name",
  endpoint: "http://consumer/endpoint",
  streams: ".*",
  names: ".*"
};

const editSchema = joi
  .object({
    endpoint: joi.string().trim().uri(),
    streams: joi.string().trim(),
    names: joi.string().trim()
  })
  .options({ presence: "required" });

const addSchema = editSchema
  .append({
    id: joi.string().trim(),
    channel: joi.string().trim().uri()
  })
  .options({ presence: "required" });

export const routes = (): Router => {
  const router = Router();

  router.get("/", async (_, res) => {
    const subs = await subscriptions().load();
    const rows = prepare(subs);
    res.render("home", { rows });
  });

  router.post("/", async (req, res) => {
    const search = req.body.search;
    if (search) {
      const subs = await subscriptions().search(search);
      const rows = prepare(subs);
      res.render("home", { rows });
    } else res.redirect("/");
  });

  router.get("/add", (_, res) => {
    res.render("add", { ...defaultSub });
  });

  router.post("/add", async (req, res) => {
    try {
      const { value, error } = addSchema.validate(req.body, {
        abortEarly: false
      });
      if (error) {
        res.render("add", {
          class: "alert-warning",
          message: error.details.map((m) => m.message).join(", "),
          ...req.body
        });
      } else {
        await subscriptions().create(value);
        res.render("add", {
          class: "alert-success",
          message: `Subscription ${value.id} created successfully!`,
          ...defaultSub
        });
      }
    } catch (error) {
      log().error(error);
      res.render("add", {
        class: "alert-danger",
        message: "Oops, something went wrong! Please check your logs.",
        ...req.body
      });
    }
  });

  router.get("/edit/:id", async (req, res) => {
    const id = req.params.id;
    const err = {
      class: "alert-danger",
      message: `Could not load subscription ${id}`
    };
    try {
      const [sub] = await subscriptions().load(id);
      if (sub) {
        res.render("edit", { ...sub, ...props(sub) });
      } else {
        res.render("edit", { ...err });
      }
    } catch (error) {
      log().error(error);
      res.render("edit", { ...err });
    }
  });

  router.post("/edit/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const { error } = editSchema.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
      });
      if (error) {
        res.render("edit", {
          class: "alert-warning",
          message: error.details.map((m) => m.message).join(", "),
          ...req.body
        });
      } else {
        await subscriptions().update(req.body);
        res.render("edit", {
          class: "alert-success",
          message: `Subscription ${id} updated successfully!`,
          ...req.body,
          ...props(req.body)
        });
      }
    } catch (error) {
      log().error(error);
      res.render("edit", {
        class: "alert-danger",
        message: "Oops, something went wrong! Please check your logs.",
        ...req.body
      });
    }
  });

  router.post("/delete/:id", async (req, res) => {
    const id = req.params.id;
    try {
      await subscriptions().delete(id);
      res.json({ deleted: true });
    } catch (error) {
      log().error(error);
      res.json({ deleted: false });
    }
  });

  router.get("/toggle/:id", async (req, res) => {
    const id = req.params.id;
    try {
      await subscriptions().toggle(id);
    } catch (error) {
      log().error(error);
    }
    res.redirect(`/edit/${id}`);
  });

  router.get("/monitor", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-store");
    req.on("error", (error) => {
      log().error(error);
    });
    req.on("close", () => {
      state().allStream(undefined);
    });
    state().allStream(res);
  });

  router.get("/monitor/:id", (req, res) => {
    const id = req.params.id;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-store");
    req.on("error", (error) => {
      log().error(error);
    });
    req.on("close", () => {
      state().stream(id, undefined);
    });
    state().stream(id, res);
  });

  return router;
};
