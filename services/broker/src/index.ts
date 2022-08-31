import { Actor } from "@rotorsoft/eventually";
import {
  broker,
  PostgresSubscriptionStore
} from "@rotorsoft/eventually-broker";
import { NextFunction, Request, Response } from "express";

const logHandler = (
  req: Request & { user: Actor },
  _: Response,
  next: NextFunction
): void => {
  console.log("Handling", req.method, req.path);
  req.user = { name: "testuser", roles: ["admin"] };
  next();
};

void broker({
  subscriptionStoreFactory: PostgresSubscriptionStore,
  middleware: [logHandler],
  resolvers: { pull: {}, push: {} },
  serviceLogLinkTemplate: process.env.BROKER_SERVICE_LOG_LINK_TEMPLATE,
  secrets: {
    byService:
      process.env.BROKER_SERVICE_QUERIES &&
      JSON.parse(process.env.BROKER_SERVICE_QUERIES),
    bySubscription:
      process.env.BROKER_SUBSCRIPTION_HEADERS &&
      JSON.parse(process.env.BROKER_SUBSCRIPTION_HEADERS)
  }
});
