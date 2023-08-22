import { Errors, config } from "@rotorsoft/eventually";
import { Response } from "express";

export type HttpStatusCode = 200 | 400 | 401 | 403 | 404 | 409 | 500;

export type JsonResponse = {
  status: HttpStatusCode;
  statusText: string;
  result?: any; // TODO: union all result types
  error?: {
    message: string;
    details?: any;
    stack?: string;
  };
};

export const Ok = (result?: any): JsonResponse => ({
  status: 200,
  statusText: "OK",
  result
});

export const BadRequest = (message?: string, details?: any): JsonResponse => ({
  status: 400,
  statusText: "Bad Request",
  error: { message: message ?? "Bad Request", details }
});

export const Unauthorized = (message?: string): JsonResponse => ({
  status: 401,
  statusText: "Unauthorized",
  error: { message: message ?? "Unauthorized" }
});

export const Forbidden = (message?: string): JsonResponse => ({
  status: 403,
  statusText: "Forbidden",
  error: { message: message ?? "Forbidden" }
});

export const NotFound = (message?: string): JsonResponse => ({
  status: 404,
  statusText: "Not Found",
  error: { message: message ?? "Not Found" }
});

export const Conflict = (message?: string): JsonResponse => ({
  status: 409,
  statusText: "Conflict",
  error: { message: message ?? "Conflict" }
});

export const InternalServerError = (
  message?: string,
  stack?: string
): JsonResponse => ({
  status: 500,
  statusText: "Internal Server Error",
  error: {
    message: message ?? "Internal Server Error",
    stack: config().env !== "production" ? stack : undefined
  }
});

export const httpError = (error: unknown): JsonResponse => {
  if (error instanceof Error) {
    const { name, message, stack } = error;
    switch (name) {
      case Errors.ValidationError:
      case Errors.InvariantError:
        return BadRequest(message, "details" in error && error.details);
      case Errors.RegistrationError:
        return NotFound(message);
      case Errors.ConcurrencyError:
      case Errors.ActorConcurrencyError:
        return Conflict(message);
    }
    return InternalServerError(message, stack);
  }
  return InternalServerError(
    typeof error === "string" ? error : "Oops, something went wrong!"
  );
};

export const send = (res: Response, json: JsonResponse): Response => {
  return res.status(json.status).send(json.error ?? json.result);
};
