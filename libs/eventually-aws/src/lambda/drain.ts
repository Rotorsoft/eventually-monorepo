import * as eventually from "@rotorsoft/eventually";
import { Ok, httpError } from "./http";
import { APIGatewayProxyResult } from "aws-lambda";

export const drain = async (): Promise<APIGatewayProxyResult> => {
  try {
    await eventually.broker().drain();
    return Ok("Drain Success!");
  } catch (error) {
    return httpError(error);
  }
};
