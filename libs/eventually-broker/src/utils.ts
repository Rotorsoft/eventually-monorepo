import { Request } from "express";
import { Actor } from "@rotorsoft/eventually";

/**
 * Validates admin user
 *
 * @param req Request payload
 * @returns boolean when is an Admin
 */
export const isAdmin = (req: Request): boolean | undefined => {
  const { user } = req as Request & { user: Actor };
  return user && user?.roles?.includes("admin");
};

const { BROKER_SERVICE_LOG_LINK_TEMPLATE } = process.env;

export const serviceLink = (service: string): string =>
  BROKER_SERVICE_LOG_LINK_TEMPLATE &&
  BROKER_SERVICE_LOG_LINK_TEMPLATE.replaceAll &&
  encodeURI(
    BROKER_SERVICE_LOG_LINK_TEMPLATE.replaceAll("<<SERVICE>>", service)
  );
