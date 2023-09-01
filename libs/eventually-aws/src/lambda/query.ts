import {
  ProjectorFactory,
  RestProjectionQuery,
  app,
  camelize,
  client,
  toProjectionQuery,
} from "@rotorsoft/eventually"
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { BadRequest, Ok, httpError } from "./http"

export const query = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const segments = event.path.split("/")
    if (segments.length !== 2)
      return BadRequest("Invalid path. Use: /projector-name", {
        path: event.path,
      })

    const projector = camelize(segments[1])

    const md = app().artifacts.get(projector)
    if (!md)
      return BadRequest("Projector not found", {
        projector,
      })
    if (md.type !== "projector")
      return BadRequest("Invalid projector", {
        projector,
        type: md.type,
      })

    const { limit } = event.queryStringParameters ?? {}
    const { ids, select, where, sort } =
      event.multiValueQueryStringParameters ?? {}
    const query: RestProjectionQuery = {
      ids,
      select,
      where,
      sort,
      limit: limit ? +limit : undefined,
    }

    const records = await client().read(
      md.factory as ProjectorFactory,
      toProjectionQuery(query, md.schema!)
    )
    return Ok(records)
  } catch (error) {
    return httpError(error)
  }
}
