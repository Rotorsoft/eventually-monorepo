import { AggregateFactory, app, camelize, client } from "@rotorsoft/eventually";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { BadRequest, Ok, httpError } from "./http";

export const load = async ({
  path
}: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const segments = path.split("/");
    if (segments.length !== 3)
      return BadRequest("Invalid path. Use: /aggregate-name/stream", {
        path
      });

    const aggregate = camelize(segments[1]);
    const stream = segments[2];

    const md = app().artifacts.get(aggregate);
    if (!md)
      return BadRequest("Aggregate not found", {
        aggregate,
        parsedPath: `/${aggregate}/${stream}`
      });
    if (md.type !== "aggregate")
      return BadRequest("Invalid aggregate", {
        aggregate,
        type: md.type,
        parsedPath: `/${aggregate}/${stream}`
      });

    const snap = await client().load(md.factory as AggregateFactory, stream);
    return Ok(
      snap,
      snap?.event?.version ? { ETag: snap?.event?.version } : undefined
    );
  } catch (error) {
    return httpError(error);
  }
};
