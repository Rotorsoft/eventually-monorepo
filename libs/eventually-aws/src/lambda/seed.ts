import * as eventually from "@rotorsoft/eventually";
import { Ok, httpError } from "./http";
import { APIGatewayProxyResult } from "aws-lambda";

export const seed = async (): Promise<APIGatewayProxyResult> => {
  try {
    await eventually.seed();
    return Ok("Seed Success!");
  } catch (error) {
    return httpError(error);
  }
};
