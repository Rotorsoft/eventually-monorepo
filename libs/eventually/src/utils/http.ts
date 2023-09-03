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

export type HttpResponse<T> = {
  status: HttpStatusCode;
  statusText?: string;
  result?: T;
  error?: {
    message: string;
    details?: any;
    stack?: string;
  };
};

export const Ok = <T>(result?: any): HttpResponse<T> => ({
  status: 200,
  statusText: "OK",
  result
});

export const BadRequest = (
  message?: string,
  details?: any
): HttpResponse<never> => ({
  status: 400,
  statusText: "Bad Request",
  error: { message: message ?? "Bad Request", details }
});

export const Unauthorized = (message?: string): HttpResponse<never> => ({
  status: 401,
  statusText: "Unauthorized",
  error: { message: message ?? "Unauthorized" }
});

export const Forbidden = (message?: string): HttpResponse<never> => ({
  status: 403,
  statusText: "Forbidden",
  error: { message: message ?? "Forbidden" }
});

export const NotFound = (message?: string): HttpResponse<never> => ({
  status: 404,
  statusText: "Not Found",
  error: { message: message ?? "Not Found" }
});

export const Conflict = (message?: string): HttpResponse<never> => ({
  status: 409,
  statusText: "Conflict",
  error: { message: message ?? "Conflict" }
});

export const InternalServerError = (
  message?: string,
  stack?: string
): HttpResponse<never> => ({
  status: 500,
  statusText: "Internal Server Error",
  error: {
    message: message ?? "Internal Server Error",
    stack: config().env !== "production" ? stack : undefined
  }
});

/**
 * Converts error to HttpResponse with error
 */
export const httpError = (error: unknown): HttpResponse<never> => {
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
  ) => Promise<HttpResponse<Snapshot<S>>>;
  load: <S extends State, C extends Messages, E extends Messages>(
    factory: AggregateFactory<S, C, E>,
    stream: string
  ) => Promise<HttpResponse<Snapshot<S>> | undefined>;
  query: <S extends State, E extends Messages>(
    factory: ProjectorFactory<S, E>,
    query: ProjectionQuery<S>
  ) => Promise<HttpResponse<ProjectionRecord<S>[]>>;
};

/**
 * Http api proxy
 *
 * @param apiUrl api host url
 * @param options fetch options
 * @param responseMapper optional reponse body mapper
 */
export const HttpProxy = (
  apiUrl: string,
  options?: RequestInit,
  responseMapper?: <T>(response: any) => HttpResponse<T>
): Proxy => {
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
        return responseMapper ? responseMapper(body) : Ok(body);
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
        const body = await response.json();
        return responseMapper ? responseMapper(body) : Ok(body);
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
        return responseMapper ? responseMapper(body) : Ok(body);
      } catch (error) {
        return httpError(error);
      }
    }
  };
};
