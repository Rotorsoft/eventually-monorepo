import { config, log } from "../ports";
import {
  AggregateFactory,
  CommandHandlerFactory,
  Errors,
  Messages,
  ProjectionQuery,
  ProjectionRecord,
  ProjectorFactory,
  Snapshot,
  State
} from "../types";
import { decamelize } from "./formatting";
import { patch } from "./patch";
import { toProjectionQueryString } from "./query";

export type HttpStatusCode = 200 | 400 | 401 | 403 | 404 | 409 | 500;

export type JsonResponse<T> = {
  status: HttpStatusCode;
  statusText: string;
  result?: T;
  error?: {
    message: string;
    details?: any;
    stack?: string;
  };
};

export const Ok = <T>(result?: any): JsonResponse<T> => ({
  status: 200,
  statusText: "OK",
  result
});

export const BadRequest = (
  message?: string,
  details?: any
): JsonResponse<never> => ({
  status: 400,
  statusText: "Bad Request",
  error: { message: message ?? "Bad Request", details }
});

export const Unauthorized = (message?: string): JsonResponse<never> => ({
  status: 401,
  statusText: "Unauthorized",
  error: { message: message ?? "Unauthorized" }
});

export const Forbidden = (message?: string): JsonResponse<never> => ({
  status: 403,
  statusText: "Forbidden",
  error: { message: message ?? "Forbidden" }
});

export const NotFound = (message?: string): JsonResponse<never> => ({
  status: 404,
  statusText: "Not Found",
  error: { message: message ?? "Not Found" }
});

export const Conflict = (message?: string): JsonResponse<never> => ({
  status: 409,
  statusText: "Conflict",
  error: { message: message ?? "Conflict" }
});

export const InternalServerError = (
  message?: string,
  stack?: string
): JsonResponse<never> => ({
  status: 500,
  statusText: "Internal Server Error",
  error: {
    message: message ?? "Internal Server Error",
    stack: config().env !== "production" ? stack : undefined
  }
});

/**
 * Converts error to JsonResponse with error
 */
export const httpError = (error: unknown): JsonResponse<never> => {
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

export type Proxy = {
  command: <
    S extends State,
    C extends Messages,
    E extends Messages,
    N extends keyof C & string
  >(
    factory: CommandHandlerFactory<S, C, E>,
    stream: string,
    name: N,
    data: C[N],
    expectedVersion?: number
  ) => Promise<JsonResponse<Snapshot<S>>>;
  load: <S extends State, C extends Messages, E extends Messages>(
    factory: AggregateFactory<S, C, E>,
    stream: string
  ) => Promise<JsonResponse<Snapshot<S>> | undefined>;
  query: <S extends State, E extends Messages>(
    factory: ProjectorFactory<S, E>,
    query: ProjectionQuery<S>
  ) => Promise<JsonResponse<ProjectionRecord<S>[]>>;
};

/**
 * Http api proxy
 *
 * @param apiUrl api host url
 * @param options fetch options
 */
export const HttpProxy = (apiUrl: string, options?: RequestInit): Proxy => {
  return {
    command: async function (factory, stream, name, data, expectedVersion) {
      const url = `${apiUrl}/${decamelize(factory.name)}/${stream}/${decamelize(
        name
      )}`;
      log().blue().trace("> Command", url, data);

      const opts = patch(options ?? {}, {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
          "If-Match": expectedVersion ? expectedVersion.toString() : ""
        }
      }) as RequestInit;
      try {
        const response = await fetch(url, opts);
        const body = await response.json();
        log().trace("< ", body);
        return Ok(body);
      } catch (error) {
        return httpError(error);
      }
    },

    load: async function (factory, stream) {
      const url = `${apiUrl}/${decamelize(factory.name)}/${stream}`;
      try {
        const response = await fetch(url, {
          ...options,
          method: "GET"
        });
        return Ok(await response.json());
      } catch (error) {
        return httpError(error);
      }
    },

    query: async function (factory, query) {
      const url = `${apiUrl}/${decamelize(factory.name)}`;
      const qs = toProjectionQueryString(query as ProjectionQuery);
      log().gray().trace("> Query", url, qs);

      try {
        const response = await fetch(`${url}?${qs}`, {
          ...options,
          method: "GET"
        });
        const body = await response.json();
        log().trace("< ", body);
        return Ok(body);
      } catch (error) {
        return httpError(error);
      }
    }
  };
};
