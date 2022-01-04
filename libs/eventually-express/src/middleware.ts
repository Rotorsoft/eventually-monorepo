import { Actor } from "@rotorsoft/eventually";
import { NextFunction, Request, Response } from "express";

export const BearerMiddleware = (
  req: Request & { actor?: Actor },
  _: Response,
  next: NextFunction
): void => {
  // TODO: extract actor from bearer token
  req.actor = { name: "bearer-actor", roles: [] };
  next && next();
};

export const GcpGatewayMiddleware = (
  req: Request & { actor?: Actor },
  _: Response,
  next: NextFunction
): void => {
  // TODO: extract actor from gcp headers
  req.actor = { name: "gcp-gateway-actor", roles: [] };
  next && next();
};
