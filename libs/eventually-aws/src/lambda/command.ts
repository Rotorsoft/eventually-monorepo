import {
  CommandHandlerFactory,
  app,
  broker,
  camelize,
  client
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

    // TODO: check all options to get claims from context
    const claims = requestContext.authorizer?.claims;
    const actor = claims ? { id: claims.email, name: claims.name } : undefined;

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

    // TODO: make this optional
    // Since we are in a serverless world that won't wait for external async operations to complete,
    // we can force a broker drain here, allowing policies and projectors to consume the new events
    if (snap?.event) await broker().drain();

    return Ok(
      snap,
      snap?.event?.version ? { ETag: snap?.event?.version } : undefined
    );
  } catch (error) {
    return httpError(error);
  }
};
