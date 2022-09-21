import { ExpressOIDC } from "@okta/oidc-middleware";
import { Actor, log } from "@rotorsoft/eventually";
import {
  broker,
  PostgresSubscriptionStore
} from "@rotorsoft/eventually-broker";
import { NextFunction, Request, Response } from "express";
import session from "express-session";

const clientId = process.env.BROKER_OPENID_CLIENT_ID;
const clientSecret = process.env.BROKER_OPENID_CLIENT_SECRET;
const domain = process.env.BROKER_OPENID_DOMAIN;

const oidc = new ExpressOIDC({
  issuer: `${domain}/oauth2/default`,
  client_id: clientId,
  client_secret: clientSecret,
  appBaseUrl: "http://localhost:8080",
  scope: "openid profile groups"
});

const logHandler = (
  req: Request & { user: Actor } & { userContext: any },
  _: Response,
  next: NextFunction
): void => {
  console.log(req.path, req.userContext.userinfo);
  const groups = req.userContext.userinfo.groups;
  const admin =
    groups &&
    Array.isArray(groups) &&
    groups.find((g) => g.endsWith("BrokerAdmin"));
  req.user = {
    name: req.userContext.userinfo.name,
    roles: admin ? ["admin"] : []
  };
  next();
};

const bootstrap = async (): Promise<void> => {
  await broker({
    subscriptionStoreFactory: PostgresSubscriptionStore,
    prehandlers: [
      session({
        secret: "this is random",
        resave: true,
        saveUninitialized: false
      }),
      oidc.router
    ],
    middleware: [oidc.ensureAuthenticated(), logHandler],
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
};

oidc.on("ready", async () => {
  await bootstrap();
});

oidc.on("error", (err: Error) => {
  log().error(err);
});
