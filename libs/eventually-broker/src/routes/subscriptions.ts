import { Actor, log, Payload } from "@andela-technology/eventually";
import { Request, Router } from "express";
import { Subscription, subscriptions } from "..";
import { state } from "../cluster";
import { toSubscriptionsView, toViewState } from "../models";
import * as schemas from "./schemas";

export const router = Router();

const shortId = (id: string): string =>
  id.length > 20 ? id.substring(0, 20) + "..." : id;

const defaultSubscription = {
  producer: "",
  consumer: "",
  path: "",
  streams: ".*",
  names: ".*",
  batch_size: 100,
  retries: 3,
  retry_timeout_secs: 10
};

const toSubscription = (
  body: Subscription
): Omit<Subscription, "active" | "position" | "updated" | "endpoint"> => ({
  id: body.id,
  producer: body.producer,
  consumer: body.consumer,
  path: body.path,
  streams: body.streams,
  names: body.names,
  batch_size: body.batch_size,
  retries: body.retries,
  retry_timeout_secs: body.retry_timeout_secs
});

router.get(
  "/",
  async (
    req: Request<never, Payload, never, { add?: boolean; search?: string }>,
    res
  ) => {
    req.query.add
      ? res.render(
          "add-subscription",
          toViewState(req as { user?: Actor }, {
            ...defaultSubscription,
            services: state().services()
          })
        )
      : res.render(
          "subscriptions",
          toViewState(
            req as { user?: Actor },
            toSubscriptionsView(
              req.query.search
                ? await subscriptions().searchSubscriptions(req.query.search)
                : await subscriptions().loadSubscriptions()
            )
          )
        );
  }
);

router.post(
  "/",
  async (req: Request<never, never, Subscription, never, never>, res) => {
    const services = state().services();
    try {
      const { value, error } = schemas.addSubscription.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
      });
      if (error) {
        res.render(
          "add-subscription",
          toViewState(req as { user?: Actor }, {
            class: "alert-warning",
            message: error.details.map((m) => m.message).join(", "),
            ...toSubscription(req.body),
            services
          })
        );
      } else {
        await subscriptions().createSubscription(value);
        res.redirect("/");
      }
    } catch (error) {
      log().error(error);
      res.render(
        "add-subscription",
        toViewState(req as { user?: Actor }, {
          class: "alert-danger",
          message: "Oops, something went wrong! Please check your logs.",
          ...toSubscription(req.body),
          services
        })
      );
    }
  }
);

router.get("/:id", async (req, res) => {
  const id = req.params.id;
  const props = {
    shortid: shortId(id),
    services: state().services()
  };
  const err = {
    class: "alert-danger",
    message: `Could not load subscription ${id}`
  };
  try {
    const [sub] = await subscriptions().loadSubscriptions(id);
    sub
      ? res.render(
          "edit-subscription",
          toViewState(req as { user?: Actor }, {
            ...props,
            ...sub,
            ...state().viewModel(sub)
          })
        )
      : res.render(
          "edit-subscription",
          toViewState(req as { user?: Actor }, {
            ...props,
            ...err
          })
        );
  } catch (error) {
    log().error(error);
    res.render(
      "edit-subscription",
      toViewState(req as { user?: Actor }, {
        ...props,
        ...err
      })
    );
  }
});

router.post(
  "/:id",
  async (
    req: Request<{ id: string }, never, Subscription, never, never>,
    res
  ) => {
    const id = req.params.id;
    const props = {
      shortid: shortId(id),
      services: state().services(),
      ...toSubscription(req.body)
    };
    try {
      const { value, error } = schemas.editSubscription.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
      });
      if (error) {
        res.render(
          "edit-subscription",
          toViewState(req as { user?: Actor }, {
            class: "alert-warning",
            message: error.details.map((m) => m.message).join(", "),
            ...props
          })
        );
      } else {
        await subscriptions().updateSubscription({ ...value, id });
        res.redirect(`/command/wait/${id}`);
      }
    } catch (error) {
      log().error(error);
      res.render(
        "edit-subscription",
        toViewState(req as { user?: Actor }, {
          class: "alert-danger",
          message: "Oops, something went wrong! Please check your logs.",
          ...props
        })
      );
    }
  }
);

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await subscriptions().deleteSubscription(id);
    res.json({ deleted: true });
  } catch (error: any) {
    log().error(error);
    res.json({ deleted: false, message: error.message });
  }
});
