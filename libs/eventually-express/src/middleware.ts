import { Actor } from "@rotorsoft/eventually";
import { NextFunction, Request, Response } from "express";

const USERINFO_HEADER = "X-Apigateway-Api-Userinfo";

/**
 * Sample UserInfo interface
 * Other scenarios will require a custom middleware implementation
 */
interface UserInfo {
  email: string;
  sub: string;
  roles: string[];
}

/**
 * Sample middleware parsing headers injected by gcp api gateway
 */
export const GcpGatewayMiddleware = (
  req: Request & { actor?: Actor },
  _: Response,
  next: NextFunction
): void => {
  const encodedUserInfo = req.get(USERINFO_HEADER);
  if (encodedUserInfo) {
    const userInfo = JSON.parse(
      Buffer.from(encodedUserInfo, "base64").toString("utf-8")
    ) as UserInfo;
    req.actor = {
      id: userInfo.sub,
      name: userInfo.email,
      roles: userInfo.roles
    };
  }
  next();
};
