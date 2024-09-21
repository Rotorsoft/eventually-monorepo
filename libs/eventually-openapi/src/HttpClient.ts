import {
  ProjectorFactory,
  decamelize,
  toRestAggQuery,
  toRestProjectionQuery,
  type AggQuery,
  type AggResult,
  type Client,
  type CommittedEvent,
  type Disposable,
  type EventResponse,
  type Messages,
  type ProjectionQuery,
  type ProjectionRecord,
  type ReducibleFactory,
  type Snapshot,
  type State
} from "@rotorsoft/eventually";
import * as axios from "axios";
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
    get: (path: string) => Promise<axios.AxiosResponse<any>>;
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
      const { data } = await axios.default.post(
        url("/".concat(decamelize(factory.name))),
        payload
      );
      return data;
    },

    command: async (factory, name, payload, target) => {
      const headers = {} as Record<string, string>;
      target.expectedVersion &&
        (headers["If-Match"] = target.expectedVersion.toString());
      const path = httpPostPath(factory.name, "aggregate", name as string);
      const { data } = await axios.default.post(
        url(path.replace(":id", target?.stream || "")),
        payload,
        {
          headers: { ...globalHeaders, ...headers }
        }
      );
      return data;
    },

    event: async (factory, event) => {
      const { status, data } = await axios.default.post<
        State,
        axios.AxiosResponse
      >(url(httpPostPath(factory.name, "policy")), event);
      return { status, ...data };
    },

    load: async (reducible, stream) => {
      const { data } = await axios.default.get(
        url(httpGetPath(reducible.name).replace(":id", stream))
      );
      return data;
    },

    query: async (query, callback) => {
      const { data } = await axios.default.get<
        any,
        axios.AxiosResponse<CommittedEvent[]>
      >(url("/all"), {
        params: query
      });
      // WARNING: to be used only in unit tests with small query responses - entire response buffer in data
      callback && data.forEach((e) => callback(e));
      return { first: data.at(0), last: data.at(-1), count: data.length };
    },

    get: (path) => axios.default.get<any>(url(path)),

    stream: async (reducible, id) => {
      const { data } = await axios.default.get(
        url(httpGetPath(reducible.name).replace(":id", id).concat("/stream"))
      );
      return data;
    },

    project: async (factory, events) => {
      const { data } = await axios.default.post(
        url(httpPostPath(factory.name, "projector")),
        events
      );
      return data;
    },

    read: async <S extends State, E extends Messages>(
      factory: ProjectorFactory<S, E>,
      query: string | string[] | ProjectionQuery<S>
    ): Promise<ProjectionRecord<S>[]> => {
      const ids =
        typeof query === "string"
          ? [query]
          : Array.isArray(query)
            ? query
            : undefined;
      const { data } = await axios.default.get<
        State,
        axios.AxiosResponse<ProjectionRecord<S>[]>
      >(url("/".concat(decamelize(factory.name))), {
        params: ids ? { ids } : toRestProjectionQuery(query as ProjectionQuery)
      });
      return data;
    },

    agg: async <S extends State, E extends Messages>(
      factory: ProjectorFactory<S, E>,
      query: AggQuery<S>
    ): Promise<AggResult<S>> => {
      const { data } = await axios.default.get<
        State,
        axios.AxiosResponse<AggResult<S>>
      >(url("/".concat(decamelize(factory.name))), {
        params: toRestAggQuery(query)
      });
      return data;
    }
  };
};
