import { log } from "@rotorsoft/eventually";
import { Router } from "express";
import joi from "joi";
import { Service, subscriptions } from "..";

export const router = Router();

const prepare = (services: Service[]): Service[] =>
  services.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));

const defaultService = {
  channel: "pg://table_name",
  url: "http://service"
};

const editSchema = joi
  .object({
    channel: joi
      .string()
      .trim()
      .uri()
      .max(100)
      .regex(/^pg|void:\/\/[a-z_]*$/),
    url: joi
      .string()
      .trim()
      .uri()
      .max(100)
      .regex(/^http|https|sse|void:\/\/[a-z_-]*$/)
  })
  .options({ presence: "required" });

const addSchema = editSchema
  .append({
    id: joi
      .string()
      .trim()
      .max(100)
      .regex(/^[a-z-]*$/)
  })
  .options({ presence: "required" });

router.get("/", async (_, res) => {
  const services = await subscriptions().loadServices();
  res.render("services", { rows: prepare(services) });
});

router.get("/add", (_, res) => {
  res.render("add-service", { ...defaultService });
});

router.post("/add", async (req, res) => {
  try {
    const { value, error } = addSchema.validate(req.body, {
      abortEarly: false
    });
    if (error) {
      res.render("add-service", {
        class: "alert-warning",
        message: error.details.map((m) => m.message).join(", "),
        ...req.body
      });
    } else {
      await subscriptions().createService(value);
      res.redirect("/services");
    }
  } catch (error) {
    log().error(error);
    res.render("add-service", {
      class: "alert-danger",
      message: "Oops, something went wrong! Please check your logs.",
      ...req.body
    });
  }
});

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  const err = {
    class: "alert-danger",
    message: `Could not load service ${id}`
  };
  try {
    const [service] = await subscriptions().loadServices(id);
    service
      ? res.render("edit-service", { ...service })
      : res.render("edit-service", { ...err });
  } catch (error) {
    log().error(error);
    res.render("edit-service", { ...err });
  }
});

router.post("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const { value, error } = editSchema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true
    });
    if (error) {
      res.render("edit-service", {
        class: "alert-warning",
        message: error.details.map((m) => m.message).join(", "),
        ...req.body
      });
    } else {
      await subscriptions().updateService({ ...value, id });
      res.redirect("/services");
    }
  } catch (error) {
    log().error(error);
    res.render("edit-service", {
      class: "alert-danger",
      message: "Oops, something went wrong! Please check your logs.",
      ...req.body
    });
  }
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await subscriptions().deleteService(id);
    res.json({ deleted: true });
  } catch (error) {
    log().error(error);
    res.json({ deleted: false });
  }
});
