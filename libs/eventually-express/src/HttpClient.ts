import {
  AllQuery,
  Client,
  CommandAdapterFactory,
  CommandHandlerFactory,
  CommandTarget,
  CommittedEvent,
  decamelize,
  EventHandlerFactory,
  Messages,
  State,
  ReducibleFactory,
  Snapshot,
  EventResponse,
  Disposable,
  ProjectorFactory,
  ProjectionResults,
  ProjectionState,
  ProjectionRecord
} from "@rotorsoft/eventually";
import axios, { AxiosResponse } from "axios";
import { httpGetPath, httpPostPath } from "./openapi/utils";

export type EventResponseEx<
  S extends State = State,
  C extends Messages = Messages
> = EventResponse<S, C> & { status: number };

type HttpClientExt = Client &
  Disposable & {
    get: (path: string) => Promise<AxiosResponse<any>>;
    stream: <S extends State, C extends Messages, E extends Messages>(
      reducible: ReducibleFactory<S, C, E>,
      id: string,
      options?: {
        useSnapshots?: boolean;
      }
    ) => Promise<Snapshot<S, E>[]>;
  };

export const HttpClient = (
  port = 3000,
  globalHeaders: Record<string, string> = {}
): HttpClientExt => {
  const url = (path: string): string => `http://localhost:${port}${path}`;
  return {
    name: "HttpClient",
    dispose: () => Promise.resolve(),
    invoke: async <
      P extends State,
      S extends State,
      C extends Messages,
      E extends Messages
    >(
      factory: CommandAdapterFactory<P, C>,
      payload: P
    ): Promise<Snapshot<S, E>[]> => {
      const { data } = await axios.post<P, AxiosResponse<Snapshot<S, E>[]>>(
        url("/".concat(decamelize(factory.name))),
        payload
      );
      return data;
    },

    command: async <S extends State, C extends Messages, E extends Messages>(
      factory: CommandHandlerFactory<S, C, E>,
      name: keyof C,
      payload: Readonly<C[keyof C]>,
      target?: CommandTarget
    ): Promise<Snapshot<S, E>[]> => {
      const headers = {} as Record<string, string>;
      target?.expectedVersion &&
        (headers["If-Match"] = target.expectedVersion.toString());
      const path = httpPostPath(
        factory.name,
        "reduce" in factory("") ? "aggregate" : "system",
        name as string
      );
      const { data } = await axios.post<State, AxiosResponse<Snapshot<S, E>[]>>(
        url(path.replace(":id", target?.id || "")),
        payload,
        {
          headers: { ...globalHeaders, ...headers }
        }
      );
      return data;
    },

    event: async <S extends State, C extends Messages, E extends Messages>(
      factory: EventHandlerFactory<S, C, E>,
      event: CommittedEvent<E>
    ): Promise<EventResponseEx<S, C>> => {
      const { status, data } = await axios.post<
        State,
        AxiosResponse<EventResponse<S, C>>
      >(url(httpPostPath(factory.name, "policy")), event);
      return { status, ...data };
    },

    load: async <S extends State, C extends Messages, E extends Messages>(
      reducible: ReducibleFactory<S, C, E>,
      id: string
    ): Promise<Snapshot<S, E>> => {
      const { data } = await axios.get<any, AxiosResponse<Snapshot<S, E>>>(
        url(httpGetPath(reducible.name).replace(":id", id))
      );
      return data;
    },

    query: async (
      query: AllQuery,
      callback?: (e: CommittedEvent) => void
    ): Promise<{
      first?: CommittedEvent;
      last?: CommittedEvent;
      count: number;
    }> => {
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

    get: (path: string): Promise<AxiosResponse<any>> =>
      axios.get<any>(url(path)),

    stream: async <S extends State, C extends Messages, E extends Messages>(
      reducible: ReducibleFactory<S, C, E>,
      id: string,
      options: {
        useSnapshots?: boolean;
      } = { useSnapshots: false }
    ): Promise<Snapshot<S, E>[]> => {
      const { data } = await axios.get<any, AxiosResponse<Snapshot<S, E>[]>>(
        url(
          httpGetPath(reducible.name)
            .replace(":id", id)
            .concat(
              `/stream${options.useSnapshots ? "?useSnapshots=true" : ""}`
            )
        )
      );
      return data;
    },

    project: async <S extends ProjectionState, E extends Messages>(
      factory: ProjectorFactory<S, E>,
      event: CommittedEvent<E>
    ): Promise<ProjectionResults<S>> => {
      const { data } = await axios.post<
        State,
        AxiosResponse<ProjectionResults<S>>
      >(url(httpPostPath(factory.name, "projector")), [event]);
      return data;
    },

    read: async <S extends ProjectionState, E extends Messages>(
      factory: ProjectorFactory<S, E>,
      ids: string[]
    ): Promise<Record<string, ProjectionRecord<S>>> => {
      const { data } = await axios.get<
        State,
        AxiosResponse<Record<string, ProjectionRecord<S>>>
      >(url(httpGetPath(factory.name).concat("/", ids[0])));
      return data;
    }
  };
};
