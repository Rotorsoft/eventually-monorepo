import { Actor } from "@rotorsoft/eventually";
import { NextFunction, Request, Response } from "express";

/**
 * Extracts actor from header
 */
export const ActorMiddleware = (
  req: Request & { actor?: Actor },
  _: Response,
  next: NextFunction
): void => {
  const encodedActor = req.get("X-Actor");
  if (encodedActor) {
    req.actor = JSON.parse(
      Buffer.from(encodedActor, "base64").toString("utf-8")
    ) as Actor;
  }
  next();
};
