import {
  CommandHandlerFactory,
  app,
  camelize,
  client,
  log
} from "@rotorsoft/eventually";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { BadRequest, Ok, httpError } from "./http";

export const command = async ({
  path,
  headers,
  body,
  requestContext
}: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const segments = path.split("/");
    if (segments.length !== 4)
      return BadRequest("Invalid path. Use: /system-name/stream/command-name", {
        path
      });

    const system = camelize(segments[1]);
    const stream = segments[2];
    const command = camelize(segments[3]);
    const ifMatch = headers["if-match"];
    const expectedVersion = ifMatch ? +ifMatch : undefined;

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

    log().trace("Auth", requestContext.authorizer);
    const claims = requestContext.authorizer?.jwt?.claims;
    const actor = { id: claims?.email ?? "", name: claims?.name ?? "" };
    const data: Record<string, any> = body ? JSON.parse(body) : {};
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
    return Ok(
      snap,
      snap?.event?.version ? { ETag: snap?.event?.version } : undefined
    );
  } catch (error) {
    return httpError(error);
  }
};
