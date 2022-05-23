import { Actor } from "@rotorsoft/eventually";
import {
  broker,
  PostgresSubscriptionStore,
  subscriptions
} from "@rotorsoft/eventually-broker";
import { NextFunction, Request, Response } from "express";

subscriptions(PostgresSubscriptionStore());

const logHandler = (
  req: Request & { user: Actor },
  _: Response,
  next: NextFunction
): void => {
  console.log("Handling", req.method, req.path);
  req.user = { name: "testuser", roles: ["admin"] };
  next();
};

void broker({ middleware: [logHandler], resolvers: { pull: {}, push: {} } });
