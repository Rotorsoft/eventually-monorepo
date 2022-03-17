import { log } from "@rotorsoft/eventually";
import { Router } from "express";
import joi from "joi";
import { Subscription, subscriptions } from ".";
import { Refresh, State } from "./utils";

const prep = (
  subs: Subscription[],
  state: State
): (Subscription & { class: string; status: string })[] =>
  subs
    .sort((a, b) => (a.active < b.active ? 1 : a.active > b.active ? -1 : 0))
    .map((sub) => ({
      class:
        state.status[sub.id] === "OK"
          ? "table-success"
          : sub.active
          ? "table-danger"
          : "table-secondary",
      status: state.status[sub.id] || "",
      ...sub
    }));

const defaultSub = {
  channel: "pg://table_name",
  endpoint: "http://consumer/endpoint",
  streams: ".*",
  names: ".*"
};

const schema = joi
  .object<Subscription>({
    id: joi.string().trim().required(),
    channel: joi.string().trim().uri().required(),
    endpoint: joi.string().trim().uri().required(),
    streams: joi.string().trim().required(),
    names: joi.string().trim().required()
  })
  .required();

export const routes = (refresh: Refresh): Router => {
  const router = Router();

  router.get("/", async (_, res) => {
    const subs = await subscriptions().load();
    const state = refresh.state();
    const rows = prep(subs, state);
    res.render("home", { rows });
  });

  router.post("/", async (req, res) => {
    const search = req.body.search;
    if (search) {
      const subs = await subscriptions().search(search);
      const state = refresh.state();
      const rows = prep(subs, state);
      res.render("home", { rows });
    } else res.redirect("/");
  });

  router.get("/add", (_, res) => {
    res.render("add", { ...defaultSub });
  });

  router.post("/add", async (req, res) => {
    const sub: Subscription = req.body;
    try {
      const { value, error } = schema.validate(sub, { abortEarly: false });
      if (error) {
        res.render("add", {
          class: "alert-warning",
          message: error.details.map((m) => m.message).join(", "),
          ...sub
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
        ...sub
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
      res.render("edit", sub ? { ...sub } : { ...err });
    } catch (error) {
      log().error(error);
      res.render("edit", { ...err });
    }
  });

  router.post("/edit", async (req, res) => {
    const sub: Subscription = req.body;
    try {
      const { value, error } = schema.validate(sub, { abortEarly: false });
      if (error) {
        res.render("edit", {
          class: "alert-warning",
          message: error.details.map((m) => m.message).join(", "),
          ...sub
        });
      } else {
        await subscriptions().update(value);
        res.render("edit", {
          class: "alert-success",
          message: `Subscription ${value.id} updated successfully!`,
          ...value
        });
      }
    } catch (error) {
      log().error(error);
      res.render("edit", {
        class: "alert-danger",
        message: "Oops, something went wrong! Please check your logs.",
        ...sub
      });
    }
  });

  router.get("/delete/:id", async (req, res) => {
    const id = req.params.id;
    try {
      await subscriptions().delete(id);
    } catch (error) {
      log().error(error);
    } finally {
      res.redirect("/");
    }
  });

  router.get("/toggle/:id", async (req, res) => {
    const id = req.params.id;
    try {
      await subscriptions().toggle(id);
    } catch (error) {
      log().error(error);
    } finally {
      res.redirect("/");
    }
  });

  return router;
};
