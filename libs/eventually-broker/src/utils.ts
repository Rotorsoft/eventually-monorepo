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
  return user && user.roles.includes("admin");
};