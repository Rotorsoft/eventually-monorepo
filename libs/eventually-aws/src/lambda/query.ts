import {
  ProjectorFactory,
  RestProjectionQuery,
  app,
  camelize,
  client,
  log,
  toProjectionQuery
} from "@rotorsoft/eventually";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { BadRequest, Ok, httpError } from "./http";

export const query = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const parts = event.path.split("/");
    if (parts.length !== 2)
      return BadRequest("Invalid path. Use: /projector-name", {
        path: event.path
      });

    const projector = camelize(parts[1]);

    log().trace("query", event.path, {
      projector,
      queryStringParameters: event.queryStringParameters,
      multiValueQueryStringParameters: event.multiValueQueryStringParameters
    });

    const md = app().artifacts.get(projector);
    if (!md)
      return BadRequest("Projector not found", {
        projector
      });
    if (md.type !== "projector")
      return BadRequest("Invalid projector", {
        projector,
        type: md.type
      });

    const { limit } = event.queryStringParameters ?? {};
    const { ids, select, where, sort } =
      event.multiValueQueryStringParameters ?? {};
    const query: RestProjectionQuery = {
      ids,
      select,
      where,
      sort,
      limit: limit ? +limit : undefined
    };

    const records = await client().read(
      md.factory as ProjectorFactory,
      toProjectionQuery(query, md.schema!)
    );
    return Ok(records);
  } catch (error) {
    return httpError(error);
  }
};
