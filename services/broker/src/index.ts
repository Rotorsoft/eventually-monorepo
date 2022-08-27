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
  apiKey: process.env.BROKER_SERVICE_API_KEY
});
