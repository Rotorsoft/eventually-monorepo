import { Actor } from "@rotorsoft/eventually";
import { NextFunction, Request, Response } from "express";

const USERINFO_HEADER = "X-Apigateway-Api-Userinfo";
interface UserInfo {
  sub: string;
  claims: string[];
}

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
      name: userInfo.sub,
      roles: userInfo.claims
    };
  }
  next();
};
