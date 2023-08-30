import {
  CommandHandlerFactory,
  app,
  camelize,
  client,
  log
} from "@rotorsoft/eventually";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { BadRequest, Ok, httpError } from "./http";

export const command = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const [, system, , command] = event.path
      .split("/")
      .map((part) => camelize(part));
    const stream = event.pathParameters?.id ?? "";
    const ifMatch = event.headers["if-match"];
    const expectedVersion = ifMatch ? +ifMatch : undefined;

    log().trace("command", event.path, {
      system,
      command,
      stream,
      expectedVersion
    });

    const factory = app().artifacts.get(system)
      ?.factory as CommandHandlerFactory;
    if (!factory)
      return BadRequest(`Invalid request: /${system}/${stream}/${command}`);

    const claims = event.requestContext.authorizer?.jwt?.claims;
    const actor = { id: claims?.email ?? "", name: claims?.name ?? "" };
    const data: Record<string, any> = event.body ? JSON.parse(event.body) : {};
    const snap = await client().command(factory, command, data, {
      stream,
      expectedVersion,
      actor
    });
    const headers = snap?.event?.version
      ? { ETag: snap?.event?.version }
      : undefined;
    return Ok(snap, headers);
  } catch (error) {
    return httpError(error);
  }
};
