import { log, randomId } from "@rotorsoft/eventually";
import { Router } from "express";
import joi from "joi";
import { Subscription, subscriptions } from "..";
import { state, SubscriptionViewModel } from "../state";

export const router = Router();

const rows = (subs: Subscription[]): { rows: SubscriptionViewModel[] } => ({
  rows: subs
    .map((sub) => ({ ...sub, ...state().viewModel(sub.id) }))
    .sort((a, b) => a.exitStatus.length - b.exitStatus.length)
});

const shortId = (id: string): string =>
  id.length > 20 ? id.substr(0, 20) + "..." : id;

const defaultSubscription = {
  producer: "",
  consumer: "",
  path: "",
  streams: ".*",
  names: ".*"
};

const editSchema = joi
  .object({
    producer: joi
      .string()
      .trim()
      .max(100)
      .regex(/^[a-z-]*$/),
    consumer: joi
      .string()
      .trim()
      .max(100)
      .regex(/^[a-z-]*$/),
    path: joi
      .string()
      .trim()
      .max(100)
      .regex(/^[a-z-]*$/),
    streams: joi.string().trim().max(100),
    names: joi.string().trim().max(250)
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

router.get("/monitor-all", (req, res) => {
  const session = randomId();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  req.on("error", (error) => {
    log().error(error);
  });
  req.on("close", () => state().unsubscribeSSE(session));
  state().subscribeSSE(session, res);
});

router.get("/monitor/:id", (req, res) => {
  const session = randomId();
  const id = req.params.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  req.on("error", (error) => {
    log().error(error);
  });
  req.on("close", () => state().unsubscribeSSE(session));
  state().subscribeSSE(session, res, id);
});

router.get("/", async (_, res) => {
  const subs = await subscriptions().loadSubscriptions();
  res.render("home", rows(subs));
});

router.post("/", async (req, res) => {
  const search = req.body.search;
  if (search) {
    const subs = await subscriptions().searchSubscriptions(search);
    res.render("home", rows(subs));
  } else res.redirect("/");
});

router.get("/add", (_, res) => {
  res.render("add-subscription", {
    ...defaultSubscription,
    services: state().services()
  });
});

router.post("/add", async (req, res) => {
  const services = state().services();
  try {
    const { value, error } = addSchema.validate(req.body, {
      abortEarly: false
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
});

router.get("/:id", async (req, res) => {
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
      : res.render("edit-subscription", { ...props, ...err });
  } catch (error) {
    log().error(error);
    res.render("edit-subscription", { ...props, ...err });
  }
});

router.post("/:id", async (req, res) => {
  const id = req.params.id;
  const props = {
    shortid: shortId(id),
    services: state().services(),
    ...req.body
  };
  try {
    const { value, error } = editSchema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true
    });
    if (error) {
      res.render("edit-subscription", {
        class: "alert-warning",
        message: error.details.map((m) => m.message).join(", "),
        ...props
      });
    } else {
      await subscriptions().updateSubscription({ ...value, id });
      res.redirect("/");
    }
  } catch (error) {
    log().error(error);
    res.render("edit-subscription", {
      class: "alert-danger",
      message: "Oops, something went wrong! Please check your logs.",
      ...props
    });
  }
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await subscriptions().deleteSubscription(id);
    res.json({ deleted: true });
  } catch (error) {
    log().error(error);
    res.json({ deleted: false });
  }
});

router.get("/toggle/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await subscriptions().toggleSubscription(id);
  } catch (error) {
    log().error(error);
  }
  res.redirect(`/${id}`);
});
