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
    const parts = event.path.split("/");
    if (parts.length !== 4)
      return BadRequest("Invalid path. Use: /system-name/stream/command-name", {
        path: event.path
      });

    const system = camelize(parts[1]);
    const stream = parts[2];
    const command = camelize(parts[3]);
    const ifMatch = event.headers["if-match"];
    const expectedVersion = ifMatch ? +ifMatch : undefined;

    log().trace("command", event.path, {
      system,
      command,
      stream,
      expectedVersion
    });

    const md = app().artifacts.get(system);
    if (!md)
      return BadRequest("System not found", {
        system,
        parsedPath: `/${system}/${stream}/${command}`
      });
    if (!(md.type === "aggregate" || md.type === "system"))
      return BadRequest("Invalid system", {
        system,
        type: md.type,
        parsedPath: `/${system}/${stream}/${command}`
      });

    const claims = event.requestContext.authorizer?.jwt?.claims;
    const actor = { id: claims?.email ?? "", name: claims?.name ?? "" };
    const data: Record<string, any> = event.body ? JSON.parse(event.body) : {};
    const snap = await client().command(
      md.factory as CommandHandlerFactory,
      command,
      data,
      {
        stream,
        expectedVersion,
        actor
      }
    );
    const headers = snap?.event?.version
      ? { ETag: snap?.event?.version }
      : undefined;
    return Ok(snap, headers);
  } catch (error) {
    return httpError(error);
  }
};
