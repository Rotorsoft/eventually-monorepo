import {
  decamelize,
  type Client,
  type CommittedEvent,
  type Disposable,
  type EventResponse,
  type Messages,
  type ProjectionQuery,
  type ReducibleFactory,
  type Snapshot,
  type State,
  app,
  RegistrationError,
  CommandHandlerFactory,
  ProjectorFactory,
  ProjectionRecord
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";
import { toRestProjectionQuery } from "./query";
import { httpGetPath, httpPostPath } from "./utils";

/**
 * Http client extended response
 */
export type EventResponseEx<
  S extends State = State,
  C extends Messages = Messages
> = EventResponse<S, C> & { status: number };

/**
 * Http client extended interface
 */
export type HttpClientExt = Client &
  Disposable & {
    get: (path: string) => Promise<AxiosResponse<any>>;
    stream: <S extends State, C extends Messages, E extends Messages>(
      reducible: ReducibleFactory<S, C, E>,
      id: string
    ) => Promise<Snapshot<S, E>[]>;
  };

/**
 * Factory function with http implementation of `Client` interface
 *
 * @param port - port number
 * @param globalHeaders - global http headers
 * @returns HttpClient
 */
export const HttpClient = (
  port = 3000,
  globalHeaders: Record<string, string> = {}
): HttpClientExt => {
  const url = (path: string): string => `http://localhost:${port}${path}`;
  return {
    name: "HttpClient",
    dispose: () => Promise.resolve(),
    invoke: async (factory, payload) => {
      const { data } = await axios.post(
        url("/".concat(decamelize(factory.name))),
        payload
      );
      return data;
    },

    command: async (name, payload, target) => {
      const msg = app().messages.get(name);
      if (!msg?.handlers.length)
        throw new RegistrationError({ name, data: payload });

      const factory = app().artifacts.get(msg.handlers[0])
        ?.factory as unknown as CommandHandlerFactory;
      if (!factory) throw new RegistrationError({ name, data: payload });

      const headers = {} as Record<string, string>;
      target.expectedVersion &&
        (headers["If-Match"] = target.expectedVersion.toString());
      const path = httpPostPath(
        factory.name,
        "reduce" in factory("") ? "aggregate" : "system",
        name as string
      );
      const { data } = await axios.post(
        url(path.replace(":id", target?.stream || "")),
        payload,
        {
          headers: { ...globalHeaders, ...headers }
        }
      );
      return data;
    },

    event: async (factory, event) => {
      const { status, data } = await axios.post<State, AxiosResponse>(
        url(httpPostPath(factory.name, "policy")),
        event
      );
      return { status, ...data };
    },

    load: async (reducible, stream) => {
      const { data } = await axios.get(
        url(httpGetPath(reducible.name).replace(":id", stream))
      );
      return data;
    },

    query: async (query, callback) => {
      const { data } = await axios.get<any, AxiosResponse<CommittedEvent[]>>(
        url("/all"),
        {
          params: query
        }
      );
      // WARNING: to be used only in unit tests with small query responses - entire response buffer in data
      callback && data.forEach((e) => callback(e));
      return { first: data.at(0), last: data.at(-1), count: data.length };
    },

    get: (path) => axios.get<any>(url(path)),

    stream: async (reducible, id) => {
      const { data } = await axios.get(
        url(httpGetPath(reducible.name).replace(":id", id).concat("/stream"))
      );
      return data;
    },

    project: async (factory, events) => {
      const { data } = await axios.post(
        url(httpPostPath(factory.name, "projector")),
        events
      );
      return data;
    },

    read: async <S extends State, E extends Messages>(
      factory: ProjectorFactory<S, E>,
      query: string | string[] | ProjectionQuery<S>,
      callback: (record: ProjectionRecord<S>) => void
    ): Promise<number> => {
      const ids =
        typeof query === "string"
          ? [query]
          : Array.isArray(query)
          ? query
          : undefined;
      const { data } = await axios.get<
        State,
        AxiosResponse<ProjectionRecord<S>[]>
      >(url("/".concat(decamelize(factory.name))), {
        params: ids ? { ids } : toRestProjectionQuery(query as ProjectionQuery)
      });
      // WARNING: to be used only in unit tests with small query responses - entire response buffer in data
      data.forEach((record) => callback(record));
      return data.length;
    }
  };
};
