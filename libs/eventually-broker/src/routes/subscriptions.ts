import { log, randomId, Actor, isAdmin } from "@rotorsoft/eventually";
import { Request, Router } from "express";
import { Subscription, subscriptions } from "..";
import { state, SubscriptionViewModel } from "../cluster";
import * as schemas from "./schemas";

export const router = Router();

const rows = (subs: Subscription[]): { rows: SubscriptionViewModel[] } => ({
  rows: subs
    .map((sub) => ({ ...sub, ...state().viewModel(sub.id) }))
    .sort((a, b) =>
      a.active < b.active
        ? 1
        : a.active > b.active
        ? -1
        : b.total - a.total
        ? b.total - a.total
        : b.position - a.position
    )
});

const shortId = (id: string): string =>
  id.length > 20 ? id.substring(0, 20) + "..." : id;

const defaultSubscription = {
  producer: "",
  consumer: "",
  path: "",
  streams: ".*",
  names: ".*"
};

router.get("/_monitor-all", (req, res) => {
  const session = randomId();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  req.on("error", (error) => {
    log().error(error);
  });
  req.on("close", () => state().unsubscribeSSE(session));
  state().subscribeSSE(session, res);
});

router.get("/_monitor/:id", (req, res) => {
  const session = randomId();
  const id = req.params.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  req.on("error", (error) => {
    log().error(error);
  });
  req.on("close", () => {
    state().unsubscribeSSE(session);
  });
  state().subscribeSSE(session, res, id);
});

router.get("/_graph", async (_, res) => {
  const subs = await subscriptions().loadSubscriptions();
  res.render("subscriptions-graph", rows(subs));
});

router.get("/", async (req: Request & { user: Actor }, res) => {
  const subs = await subscriptions().loadSubscriptions();
  res.render("subscriptions", {isAdmin: isAdmin(req), ...rows(subs)});
});

router.post(
  "/",
  async (req: Request<never, never, { search: string }, never, never>, res) => {
    const search = req.body.search;
    if (search) {
      const subs = await subscriptions().searchSubscriptions(search);
      res.render("subscriptions", rows(subs));
    } else res.redirect("/");
  }
);

router.get("/_add", (_, res) => {
  res.render("add-subscription", {
    ...defaultSubscription,
    services: state().services()
  });
});

router.post(
  "/_add",
  async (req: Request<never, never, Subscription, never, never>, res) => {
    const services = state().services();
    try {
      const { value, error } = schemas.addSubscription.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
      });
      if (error) {
        res.render("add-subscription", {
          class: "alert-warning",
          message: error.details.map((m) => m.message).join(", "),
          ...req.body,
          services
        });
      } else {
        await subscriptions().createSubscription(value);
        res.redirect("/");
      }
    } catch (error) {
      log().error(error);
      res.render("add-subscription", {
        class: "alert-danger",
        message: "Oops, something went wrong! Please check your logs.",
        ...req.body,
        services
      });
    }
  }
);

router.get("/_toggle/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await subscriptions().toggleSubscription(id);
  } catch (error) {
    log().error(error);
  }
  res.redirect(`/_wait/${id}`);
});

router.get("/_refresh/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await state().refreshSubscription("RESTART", id);
  } catch (error) {
    log().error(error);
  }
  res.redirect(`/${id}`);
});

router.get("/_wait/:id", (req, res) => {
  const id = req.params.id;
  res.render("wait", { id });
});

router.get("/:id", async (req: Request & { user: Actor }, res) => {
  const id = req.params.id;
  const props = {
    shortid: shortId(id),
    ...state().viewModel(id),
    services: state().services()
  };
  const err = {
    class: "alert-danger",
    message: `Could not load subscription ${id}`
  };
  try {
    const [sub] = await subscriptions().loadSubscriptions(id);
    sub
      ? res.render("edit-subscription", {
          ...props,
          ...sub
        })
      : res.render("edit-subscription", { ...props, ...err, isAdmin: isAdmin(req)});
  } catch (error) {
    log().error(error);
    res.render("edit-subscription", { ...props, ...err, isAdmin });
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
      ...req.body
    };
    try {
      const { value, error } = schemas.editSubscription.validate(req.body, {
        abortEarly: false,
        allowUnknown: true
      });
      if (error) {
        res.render("edit-subscription", {
          class: "alert-warning",
          message: error.details.map((m) => m.message).join(", "),
          ...props, 
          isAdmin: isAdmin(req)
        });
      } else {
        await subscriptions().updateSubscription({ ...value, id });
        res.redirect(`/_wait/${id}`);
      }
    } catch (error) {
      log().error(error);
      res.render("edit-subscription", {
        class: "alert-danger",
        message: "Oops, something went wrong! Please check your logs.",
        ...props,
        isAdmin: isAdmin(req)
      });
    }
  }
);

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await subscriptions().deleteSubscription(id);
    res.json({ deleted: true });
  } catch (error) {
    log().error(error);
    res.json({ deleted: false, message: error.message });
  }
});
