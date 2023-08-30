import { Errors, config } from "@rotorsoft/eventually"
import { APIGatewayProxyResult } from "aws-lambda"

export type HttpStatusCode = 200 | 400 | 401 | 403 | 404 | 409 | 500

export const Ok = (
  result?: any,
  headers?: Record<string, string | number | boolean>
): APIGatewayProxyResult => ({
  statusCode: 200,
  body: JSON.stringify({ result }),
  headers,
})

export const BadRequest = (
  message?: string,
  details?: any
): APIGatewayProxyResult => ({
  statusCode: 400,
  body: JSON.stringify({
    error: { message: message ?? "Bad Request", details },
  }),
})

export const Unauthorized = (message?: string): APIGatewayProxyResult => ({
  statusCode: 401,
  body: JSON.stringify({
    error: { message: message ?? "Unauthorized" },
  }),
})

export const Forbidden = (message?: string): APIGatewayProxyResult => ({
  statusCode: 403,
  body: JSON.stringify({
    error: { message: message ?? "Forbidden" },
  }),
})

export const NotFound = (message?: string): APIGatewayProxyResult => ({
  statusCode: 404,
  body: JSON.stringify({
    error: { message: message ?? "Not Found" },
  }),
})

export const Conflict = (message?: string): APIGatewayProxyResult => ({
  statusCode: 409,
  body: JSON.stringify({
    error: { message: message ?? "Conflict" },
  }),
})

export const InternalServerError = (
  message?: string,
  stack?: string
): APIGatewayProxyResult => ({
  statusCode: 500,
  body: JSON.stringify({
    error: {
      message: message ?? "Internal Server Error",
      stack: config().env !== "production" ? stack : undefined,
    },
  }),
})

export const httpError = (error: unknown): APIGatewayProxyResult => {
  if (error instanceof Error) {
    const { name, message, stack } = error
    switch (name) {
      case Errors.ValidationError:
      case Errors.InvariantError:
        return BadRequest(message, "details" in error && error.details)
      case Errors.RegistrationError:
        return NotFound(message)
      case Errors.ConcurrencyError:
      case Errors.ActorConcurrencyError:
        return Conflict(message)
    }
    return InternalServerError(message, stack)
  }
  return InternalServerError(
    typeof error === "string" ? error : "Oops, something went wrong!"
  )
}
