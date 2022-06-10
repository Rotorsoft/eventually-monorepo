import { log } from "@rotorsoft/eventually";
import { Request, Router } from "express";
import { Service, subscriptions } from "..";
import { isAdmin, serviceLink } from "../utils";
import * as schemas from "./schemas";

export const router = Router();

const prepare = (services: Service[]): Service[] =>
  services
    .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))
    .map((s) => ({
      ...s,
      sll: serviceLink(s.id)
    }));

const defaultService = {
  channel: "pg://table_name",
  url: "http://service"
};

router.get("/", async (req, res) => {
  const services = await subscriptions().loadServices();
  res.render("services", { isAdmin: isAdmin(req), rows: prepare(services) });
});

router.get("/_add", (req, res) => {
  res.render("add-service", { ...defaultService, isAdmin: isAdmin(req) });
});

router.post(
  "/_add",
  async (req: Request<never, never, Service, never, never>, res) => {
    try {
      const { value, error } = schemas.addService.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
      });
      if (error) {
        res.render("add-service", {
          class: "alert-warning",
          message: error.details.map((m) => m.message).join(", "),
          ...req.body,
          isAdmin: isAdmin(req)
        });
      } else {
        await subscriptions().createService(value);
        res.redirect("/_services");
      }
    } catch (error) {
      log().error(error);
      res.render("add-service", {
        class: "alert-danger",
        message: "Oops, something went wrong! Please check your logs.",
        ...req.body,
        isAdmin: isAdmin(req)
      });
    }
  }
);

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  const err = {
    class: "alert-danger",
    message: `Could not load service ${id}`
  };
  try {
    const [service] = await subscriptions().loadServices(id);
    service
      ? res.render("edit-service", { ...service, isAdmin: isAdmin(req) })
      : res.render("edit-service", { ...err, isAdmin: isAdmin(req) });
  } catch (error) {
    log().error(error);
    res.render("edit-service", { ...err, isAdmin: isAdmin(req) });
  }
});

router.post(
  "/:id",
  async (req: Request<{ id: string }, never, Service, never, never>, res) => {
    const id = req.params.id;
    try {
      const { value, error } = schemas.editService.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
      });
      if (error) {
        res.render("edit-service", {
          class: "alert-warning",
          message: error.details.map((m) => m.message).join(", "),
          ...req.body,
          isAdmin: isAdmin(req)
        });
      } else {
        await subscriptions().updateService({ ...value, id });
        res.redirect("/_services");
      }
    } catch (error) {
      log().error(error);
      res.render("edit-service", {
        class: "alert-danger",
        message: "Oops, something went wrong! Please check your logs.",
        ...req.body,
        isAdmin: isAdmin(req)
      });
    }
  }
);

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await subscriptions().deleteService(id);
    res.json({ deleted: true });
  } catch (error) {
    log().error(error);
    res.json({ deleted: false, message: error.message });
  }
});
