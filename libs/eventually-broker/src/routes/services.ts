import { AllQuery, CommittedEvent, log, Payload } from "@rotorsoft/eventually";
import { Request, Router } from "express";
import { Service, subscriptions } from "..";
import { state } from "../cluster";
import { toViewState } from "../models";
import { getStream } from "../queries";
import * as schemas from "./schemas";

export const router = Router();

const prepare = (services: Service[]): Service[] =>
  services
    .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))
    .map((s) => ({
      ...s,
      sll: state().serviceLogLink(s.id)
    }));

const defaultService = {
  channel: "pg://table_name",
  url: "http://service"
};

const toService = (body: Service): Pick<Service, "id" | "channel" | "url"> => ({
  id: body.id,
  channel: body.channel,
  url: body.url
});

router.get(
  "/",
  (req: Request<never, Payload, never, { add?: boolean }>, res) => {
    req.query.add
      ? res.render(
          "add-service",
          toViewState(req as unknown as Request, defaultService)
        )
      : res.render(
          "services",
          toViewState(req as unknown as Request, {
            rows: prepare(state().services())
          })
        );
  }
);

router.post(
  "/",
  async (req: Request<never, never, Service, never, never>, res) => {
    try {
      const { value, error } = schemas.addService.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
      });
      if (error) {
        res.render(
          "add-service",
          toViewState(req, {
            class: "alert-warning",
            message: error.details.map((m) => m.message).join(", "),
            ...toService(req.body)
          })
        );
      } else {
        await subscriptions().createService(value);
        res.redirect("/services");
      }
    } catch (error) {
      log().error(error);
      res.render(
        "add-service",
        toViewState(req, {
          class: "alert-danger",
          message: "Oops, something went wrong! Please check your logs.",
          ...toService(req.body)
        })
      );
    }
  }
);

router.get("/:id", (req, res) => {
  const id = req.params.id;
  const err = {
    class: "alert-danger",
    message: `Could not load service ${id}`
  };
  try {
    const service = state()
      .services()
      .find((s) => s.id === id);
    service
      ? res.render("edit-service", toViewState(req, service))
      : res.render("edit-service", toViewState(req, err));
  } catch (error) {
    log().error(error);
    res.render("edit-service", toViewState(req, err));
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
        res.render(
          "edit-service",
          toViewState(req, {
            class: "alert-warning",
            message: error.details.map((m) => m.message).join(", "),
            ...toService(req.body)
          })
        );
      } else {
        await subscriptions().updateService({ ...value, id });
        res.redirect("/services");
      }
    } catch (error) {
      log().error(error);
      res.render(
        "edit-service",
        toViewState(req, {
          class: "alert-danger",
          message: "Oops, something went wrong! Please check your logs.",
          ...toService(req.body)
        })
      );
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

router.get(
  "/:id/events",
  async (
    req: Request<
      { id: string },
      CommittedEvent<string, Payload>[],
      never,
      AllQuery
    >,
    res
  ) => {
    try {
      const id = req.params.id;
      const { stream, names, after, created_before, created_after } = req.query;
      const service = state()
        .services()
        .find((s) => s.id === id);

      const query: AllQuery = {
        stream,
        names: names && (Array.isArray(names) ? names : [names]),
        after: after && +after,
        limit: 100,
        created_after: created_after && new Date(created_after),
        created_before: created_before && new Date(created_before),
        backward: !(after || created_after)
      };

      const results = await getStream(service, query);
      res.render("events", { id, stream: results, query });
    } catch (error) {
      res.render("services");
    }
  }
);

router.get(
  "/:id/events/:eventid",
  async (req: Request<{ id: string; eventid: number }>, res) => {
    const id = req.params.id;
    const eventid = req.params.eventid;
    try {
      const service = state()
        .services()
        .find((s) => s.id === id);
      const event = await getStream(service, { after: eventid - 1, limit: 1 });
      res.json(event);
    } catch (error) {
      res.render("services");
    }
  }
);

router.get(
  "/:id/stream/:stream",
  async (req: Request<{ id: string; stream: string }>, res) => {
    const id = req.params.id;
    const stream = req.params.stream;
    try {
      const service = state()
        .services()
        .find((s) => s.id === id);
      const payloads = await getStream(service, {
        stream,
        limit: 100,
        backward: true
      });
      res.json(payloads);
    } catch (error) {
      res.render("services");
    }
  }
);
